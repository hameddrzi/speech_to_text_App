import { File, FileMode, type FileHandle } from 'expo-file-system';
import { initWhisper, type TranscribeOptions, type TranscribeResult, type WhisperContext } from 'whisper.rn/index';

import {
  CHUNK_THRESHOLD_SEC,
  chunkByteRange,
  dropOverlap,
  durationSec,
  offsetSegments,
  overallProgress,
  parseWavHeader,
  planChunks,
  promptFromSegments,
  SAMPLE_RATE,
  type WavLayout,
} from '@/stt/chunking';
import { isModelDownloaded, modelFile } from '@/stt/model-files';
import { modelInfo, type SpeechModel } from '@/stt/models';
import {
  TranscriptionCancelledError,
  type CancelSignal,
  type FileTranscribeRequest,
  type SttRequest,
  type SttSegment,
} from '@/stt/types';

/**
 * The single on-device Whisper engine (whisper.cpp via whisper.rn).
 *
 * whisper.rn allows one job per context at a time, so every call goes through `exclusive()`:
 * file jobs queue up, while live previews use `tryExclusive()` and are simply skipped when busy.
 */

let context: WhisperContext | null = null;
let contextModel: SpeechModel | null = null;
let chain: Promise<unknown> = Promise.resolve();
let busy = false;

export class ModelMissingError extends Error {
  constructor(model: SpeechModel) {
    super(`The ${modelInfo(model).label} speech model is not downloaded yet. Download it in Profile → Transcription.`);
    this.name = 'ModelMissingError';
  }
}

async function getContext(model: SpeechModel): Promise<WhisperContext> {
  if (context && contextModel === model) return context;
  if (!isModelDownloaded(model)) throw new ModelMissingError(model);
  if (context) {
    await context.release().catch(() => {});
    context = null;
    contextModel = null;
  }
  context = await initWhisper({ filePath: modelFile(model).uri, useGpu: true });
  contextModel = model;
  return context;
}

/** The app transcribes English only. */
const OPTIONS: TranscribeOptions = { language: 'en', maxLen: 0 };

/**
 * Whisper writes sound events instead of words for silence and noise: "[BLANK_AUDIO]", "[Music]",
 * "(upbeat music)", "*laughs*". They are not speech, so they never reach the transcript.
 */
const NON_SPEECH =
  /\[[^\]]*\]|\((?:[^)]*\b(?:music|silence|applause|laugh\w*|noise|inaudible|cough\w*|sigh\w*|blank audio)\b[^)]*)\)|\*[^*]*\*/gi;

function cleanText(text: string): string {
  return text.replace(NON_SPEECH, ' ').replace(/\s+/g, ' ').trim();
}

function exclusive<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    busy = true;
    try {
      return await job();
    } finally {
      busy = false;
    }
  });
  chain = run.catch(() => {});
  return run;
}

/** Runs the job only if the engine is idle right now; resolves to null otherwise. */
function tryExclusive<T>(job: () => Promise<T>): Promise<T | null> {
  if (busy) return Promise.resolve(null);
  return exclusive(job);
}

export const sttSupported = true;

export function isEngineBusy(): boolean {
  return busy;
}

type WhisperTask = ReturnType<WhisperContext['transcribe']>;

function throwIfCancelled(signal?: CancelSignal): void {
  if (signal?.aborted) throw new TranscriptionCancelledError();
}

/**
 * Awaits a whisper.rn job, wiring the cancel signal to its `stop()`. whisper.rn can only abort a job
 * once the native side has created it (after the audio is decoded), so an early stop is repeated
 * from the progress callback (`restop`) and an aborted signal always rejects, whatever the result.
 */
async function runTask(start: (restop: () => void) => WhisperTask, signal?: CancelSignal): Promise<TranscribeResult> {
  throwIfCancelled(signal);
  let task: WhisperTask | null = null;
  const stop = () => {
    task?.stop().catch(() => {});
  };
  const restop = () => {
    if (signal?.aborted) stop();
  };
  task = start(restop);
  signal?.addEventListener('abort', stop);
  try {
    const result = await task.promise;
    if (result.isAborted || signal?.aborted) throw new TranscriptionCancelledError();
    return result;
  } finally {
    signal?.removeEventListener('abort', stop);
  }
}

/** whisper.rn times are in centiseconds. */
function toSegments(result: TranscribeResult): SttSegment[] {
  return result.segments
    .map((s) => ({ start: s.t0 / 100, end: s.t1 / 100, text: cleanText(s.text) }))
    .filter((s) => s.text.length > 0);
}

const HEADER_PROBE_BYTES = 4096;

/** Reads just the WAV header; the PCM itself stays on disk. */
function readLayout(handle: FileHandle): WavLayout {
  const size = handle.size ?? 0;
  handle.offset = 0;
  return parseWavHeader(handle.readBytes(Math.min(HEADER_PROBE_BYTES, size)), size);
}

/**
 * Long recordings: reads ~5-minute slices of PCM from disk and transcribes each with
 * `transcribeData()`, so memory stays the same whatever the length (whisper.rn's file API would
 * decode the whole file and build its full mel spectrogram, see chunking.ts).
 */
async function transcribeChunked(
  ctx: WhisperContext,
  handle: FileHandle,
  layout: WavLayout,
  req: FileTranscribeRequest,
): Promise<SttSegment[]> {
  const total = durationSec(layout);
  const { resume } = req;
  const fromSec = resume?.nextOffsetSec ?? 0;
  const done: SttSegment[] = resume ? [...resume.segments] : [];
  const chunks = planChunks(total, fromSec);

  for (const chunk of chunks) {
    throwIfCancelled(req.signal);
    const { offset, length } = chunkByteRange(chunk, layout);
    if (length < 2) break;
    handle.offset = offset;
    const bytes = handle.readBytes(length);
    // transcribeData() takes 16-bit PCM in an ArrayBuffer of exactly the samples.
    const pcm =
      bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? bytes.buffer
        : (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);

    const prompt = promptFromSegments(done);
    const result = await runTask(
      (restop) =>
        ctx.transcribeData(pcm, {
          ...OPTIONS,
          ...(prompt ? { prompt } : null),
          onProgress: (p) => {
            restop();
            req.onProgress?.(overallProgress(chunk.index, p / 100, chunks.length, fromSec, total));
          },
        }),
      req.signal,
    );

    done.push(...dropOverlap(done, offsetSegments(toSegments(result), chunk.readStartSec)));
    req.onChunk?.({ segments: [...done], nextOffsetSec: chunk.endSec });
  }
  return done;
}

/**
 * Full, accurate pass over a saved WAV file → time-coded segments.
 * Recordings longer than CHUNK_THRESHOLD_SEC are transcribed in chunks (see transcribeChunked);
 * the whole job holds the engine, so live previews never interleave with a file in progress.
 */
export function transcribeFile(uri: string, req: FileTranscribeRequest): Promise<SttSegment[]> {
  return exclusive(async () => {
    throwIfCancelled(req.signal);
    const ctx = await getContext(req.model);

    const file = new File(uri);
    if (!file.exists) throw new Error('The audio file of this recording is missing.');
    const handle = file.open(FileMode.ReadOnly);
    try {
      const layout = readLayout(handle);
      // The recorder always writes 16 kHz mono 16-bit, which is what transcribeData() expects.
      const whisperPcm = layout.sampleRate === SAMPLE_RATE && layout.channels === 1 && layout.bitsPerSample === 16;
      if (whisperPcm && durationSec(layout) > CHUNK_THRESHOLD_SEC) {
        return await transcribeChunked(ctx, handle, layout, req);
      }
    } finally {
      handle.close();
    }

    const result = await runTask(
      (restop) =>
        ctx.transcribe(uri, {
          ...OPTIONS,
          onProgress: (p) => {
            restop();
            req.onProgress?.(p / 100);
          },
        }),
      req.signal,
    );
    return toSegments(result);
  });
}

/** Quick pass over a window of 16 kHz mono 16-bit PCM for the live preview. Null when the engine is busy. */
export function transcribePcmIfIdle(pcm: Uint8Array, req: SttRequest): Promise<string | null> {
  return tryExclusive(async () => {
    const ctx = await getContext(req.model);
    const buffer = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength) as ArrayBuffer;
    const { promise } = ctx.transcribeData(buffer, OPTIONS);
    const result = await promise;
    return cleanText(result.result);
  });
}

export async function releaseEngine(): Promise<void> {
  await exclusive(async () => {
    if (context) await context.release().catch(() => {});
    context = null;
    contextModel = null;
  });
}
