import type { AudioSource } from './use-audio-source';

export type { AudioSource } from './use-audio-source';

/** Native: the stored file URI is played as is (it is rebased on load, see recording-files.ts). */
export function useAudioSource(uri: string | null): AudioSource {
  return { source: uri, missing: false };
}
