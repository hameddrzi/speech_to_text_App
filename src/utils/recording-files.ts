import { Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Recording audio lives in documents/recordings/rec-<id>.wav, but recordings.json stores an absolute
 * `file://` URI. On iOS the app container path (…/Application/<UUID>/Documents) changes with every app
 * update, so a stored URI goes stale. Every stored URI is therefore re-pointed at the *current*
 * recordings directory by its file name.
 */

/** Pure part of `resolveRecordingUri`: rebuilds `uri` as `<dirUri>/<file name>`. Exported for tests. */
export function rebaseRecordingUri(uri: string | null, dirUri: string): string | null {
  if (!uri) return uri;
  // Only plain local files inside a `recordings` folder are ours; leave anything else (content://, assets…) alone.
  if (!/^file:\/\//i.test(uri) && !uri.startsWith('/')) return uri;
  const parts = uri.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/');
  const fileName = parts[parts.length - 1];
  const parent = parts[parts.length - 2];
  if (!fileName || parent !== 'recordings') return uri;
  return `${dirUri.replace(/\/+$/, '')}/${fileName}`;
}

let cachedDirUri: string | null = null;

function recordingsDirUri(): string {
  cachedDirUri ??= new Directory(Paths.document, 'recordings').uri;
  return cachedDirUri;
}

/** The URI of a recording's audio file in this install's recordings directory. Web: unchanged. */
export function resolveRecordingUri(uri: string | null): string | null {
  if (!uri || Platform.OS === 'web') return uri;
  try {
    return rebaseRecordingUri(uri, recordingsDirUri());
  } catch {
    return uri;
  }
}

/**
 * Drops volatile fields before a recording is written to disk: `transcriptProgress` and any other
 * field ending in `Progress`. Every other field (including optional ones added later) is kept.
 */
export function stripVolatileFields<T extends object>(record: T): T {
  let out: Record<string, unknown> | null = null;
  for (const key of Object.keys(record)) {
    if (key.endsWith('Progress')) {
      out ??= { ...(record as Record<string, unknown>) };
      delete out[key];
    }
  }
  return (out ?? record) as T;
}
