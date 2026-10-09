import type { SpeechModel } from '@/stt/models';

export type SttSegment = {
  /** Seconds from the start of the audio. */
  start: number;
  end: number;
  text: string;
};

export type SttRequest = {
  model: SpeechModel;
  /** 0–1 progress callback (file transcription only). */
  onProgress?: (fraction: number) => void;
};

export type SttPartial = {
  /** Segments of the chunks finished so far, in recording time. */
  segments: SttSegment[];
  /** Start of the next chunk (seconds). */
  nextOffsetSec: number;
};

/** The part of an AbortSignal the engine needs (a real AbortSignal fits). */
export type CancelSignal = {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void): void;
  removeEventListener(type: 'abort', listener: () => void): void;
};

export type FileTranscribeRequest = SttRequest & {
  /** Aborting stops the native job; the promise then rejects with TranscriptionCancelledError. */
  signal?: CancelSignal;
  /** Long files only: continue after chunks a previous (killed) attempt already finished. */
  resume?: SttPartial;
  /** Long files only: called after each chunk with everything finished so far, to persist it. */
  onChunk?: (partial: SttPartial) => void;
};

export class TranscriptionCancelledError extends Error {
  constructor() {
    super('Transcription cancelled.');
    this.name = 'TranscriptionCancelledError';
  }
}

/**
 * Decoder settings for a quick PCM pass (the live preview). Same names as whisper.rn's TranscribeOptions:
 * `maxThreads` CPU threads, `temperatureInc: 0` turns off the temperature-fallback retries, `bestOf`
 * candidates for greedy sampling.
 */
export type PcmTuning = {
  maxThreads?: number;
  temperatureInc?: number;
  bestOf?: number;
};
