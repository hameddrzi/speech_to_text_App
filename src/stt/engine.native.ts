import { initWhisper, type TranscribeOptions, type WhisperContext } from 'whisper.rn/index';

import { isModelDownloaded, modelFile } from '@/stt/model-files';
import { modelInfo, type SpeechModel } from '@/stt/models';
import type { SttRequest, SttSegment } from '@/stt/types';

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

/** Full, accurate pass over a saved WAV file → time-coded segments. */
export function transcribeFile(uri: string, req: SttRequest): Promise<SttSegment[]> {
  return exclusive(async () => {
    const ctx = await getContext(req.model);
    const { promise } = ctx.transcribe(uri, {
      ...OPTIONS,
      onProgress: req.onProgress ? (p) => req.onProgress?.(p / 100) : undefined,
    });
    const result = await promise;
    return result.segments
      .map((s) => ({ start: s.t0 / 100, end: s.t1 / 100, text: s.text.trim() }))
      .filter((s) => s.text.length > 0);
  });
}

/** Quick pass over a window of 16 kHz mono 16-bit PCM for the live preview. Null when the engine is busy. */
export function transcribePcmIfIdle(pcm: Uint8Array, req: SttRequest): Promise<string | null> {
  return tryExclusive(async () => {
    const ctx = await getContext(req.model);
    const buffer = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength) as ArrayBuffer;
    const { promise } = ctx.transcribeData(buffer, OPTIONS);
    const result = await promise;
    return result.result.trim();
  });
}

export async function releaseEngine(): Promise<void> {
  await exclusive(async () => {
    if (context) await context.release().catch(() => {});
    context = null;
    contextModel = null;
  });
}
