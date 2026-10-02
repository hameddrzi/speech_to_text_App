import type { SpeechModel } from '@/stt/models';

/** Languages a recording can be tagged with. */
export type RecordingLanguage = 'fa' | 'en' | 'it';

export type SttLanguage = RecordingLanguage | 'auto';

export const LANGUAGE_NAMES: Record<RecordingLanguage, string> = {
  fa: 'فارسی',
  en: 'English',
  it: 'Italiano',
};

export type SttSegment = {
  /** Seconds from the start of the audio. */
  start: number;
  end: number;
  text: string;
};

export type SttRequest = {
  model: SpeechModel;
  language: SttLanguage;
  /** 0–1 progress callback (file transcription only). */
  onProgress?: (fraction: number) => void;
};
