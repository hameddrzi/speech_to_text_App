import { useEffect, useState } from 'react';

import { resolveWebAudio } from '@/utils/web-audio';

export type AudioSource = {
  /** URL to hand to the player; null while resolving, when missing, or for mock recordings. */
  source: string | null;
  /** The recording has a URI but its audio can't be played (e.g. a temporary web URL from an earlier visit). */
  missing: boolean;
};

/**
 * Web: turns a stored recording URI (`idb:<id>`, a `blob:` URL, or a plain URL) into a playable URL,
 * checking first that it still exists, so the browser player never receives a dead source.
 * (Native: use-audio-source.native.ts passes the file URI straight through.)
 */
export function useAudioSource(uri: string | null): AudioSource {
  const [state, setState] = useState<{ uri: string | null; source: string | null; missing: boolean }>({
    uri: null,
    source: null,
    missing: false,
  });

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    let revoke: string | null = null;
    resolveWebAudio(uri).then((res) => {
      if (res?.revoke) revoke = res.url;
      if (cancelled) {
        if (revoke) URL.revokeObjectURL(revoke);
        return;
      }
      setState({ uri, source: res?.url ?? null, missing: !res });
    });
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [uri]);

  // Results for another URI (the recording changed) don't count.
  if (!uri || state.uri !== uri) return { source: null, missing: false };
  return { source: state.source, missing: state.missing };
}
