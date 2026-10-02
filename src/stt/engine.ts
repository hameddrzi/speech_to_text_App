import type { SttRequest, SttSegment } from '@/stt/types';

/**
 * Web stand-in for the on-device Whisper engine (see engine.native.ts).
 * whisper.cpp only runs inside the iOS/Android app, so the web preview reports it as unavailable.
 */

export class ModelMissingError extends Error {}

export const sttSupported = false;

const UNSUPPORTED = 'Transcription runs on your phone. Open the mobile app to transcribe recordings.';

export function isEngineBusy(): boolean {
  return false;
}

export function transcribeFile(_uri: string, _req: SttRequest): Promise<SttSegment[]> {
  return Promise.reject(new Error(UNSUPPORTED));
}

export function transcribePcmIfIdle(_pcm: Uint8Array, _req: SttRequest): Promise<string | null> {
  return Promise.resolve(null);
}

export async function releaseEngine(): Promise<void> {}
