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
