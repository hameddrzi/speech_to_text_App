import * as Device from 'expo-device';

import type { SpeechModel } from '@/stt/models';

/**
 * Phones sold as "6 GB" report roughly 5.3–5.8 GB of total memory (the rest is reserved by the
 * system), so the cut-off sits below that: 4 GB phones (≈ 3.6 GB reported) are excluded.
 */
const MIN_MEMORY_BYTES = 5_000_000_000;

/**
 * Why the live preview can't run for this model on this phone, or null when it can. A Whisper pass
 * every couple of seconds competes with the microphone for CPU and memory; with the Turbo model or on
 * phones with less than 6 GB of RAM that risks stutters or the app being killed mid-take.
 * The Profile switch stays as the user set it; this only overrides it while the reason applies.
 */
export function livePreviewBlockReason(model: SpeechModel): string | null {
  if (model === 'turbo') return 'Live preview is off for the Turbo model to keep recording smooth.';
  const memory = Device.totalMemory;
  if (memory != null && memory < MIN_MEMORY_BYTES) {
    return 'Live preview is off on phones with less than 6 GB of memory to keep recording smooth.';
  }
  return null;
}
