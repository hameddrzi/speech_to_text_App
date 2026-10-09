/**
 * Web only: keeps recorded audio across reloads.
 *
 * The browser recorder hands back a `blob:` URL that dies with the page, so the recorded Blob is copied
 * into IndexedDB (no 5 MB localStorage quota) and the recording stores `idb:<id>` instead. Playback turns
 * that back into a fresh object URL (`resolveWebAudio`). The native app never uses this file
 * (see web-audio.native.ts).
 */

const DB_NAME = 'voice-audio';
const STORE = 'recordings';
const PREFIX = 'idb:';

export function isStoredWebAudio(uri: string | null | undefined): boolean {
  return !!uri && uri.startsWith(PREFIX);
}

/** Temporary blob: URLs handed out by this page (only these can still be alive). */
const liveTempUris = new Set<string>();

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'));
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = op(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result as T);
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB request failed'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB request aborted'));
      }),
  );
}

/**
 * Copies the audio behind a temporary `blob:` URL into IndexedDB under `id` and returns the URI to
 * store (`idb:<id>`). If that fails (private mode, quota), the temporary URL is returned unchanged: it
 * still plays until the page is reloaded.
 */
export async function persistWebAudio(id: string, tempUri: string): Promise<string> {
  try {
    const blob = await (await fetch(tempUri)).blob();
    if (!blob.size) throw new Error('Empty recording');
    await run('readwrite', (s) => s.put(blob, id));
    return PREFIX + id;
  } catch {
    liveTempUris.add(tempUri);
    return tempUri;
  }
}

/**
 * A playable URL for a stored recording URI, or null when its audio is gone: a missing IndexedDB entry,
 * or a `blob:` URL from an earlier page load (recordings made before audio was persisted). The caller
 * revokes object URLs it gets for `idb:` URIs (`revoke`).
 */
export async function resolveWebAudio(uri: string): Promise<{ url: string; revoke: boolean } | null> {
  if (isStoredWebAudio(uri)) {
    try {
      const blob = await run<Blob | undefined>('readonly', (s) => s.get(uri.slice(PREFIX.length)));
      return blob ? { url: URL.createObjectURL(blob), revoke: true } : null;
    } catch {
      return null;
    }
  }
  if (uri.startsWith('blob:')) {
    // A blob: URL only works in the page that created it; a dead one makes <audio> throw NotSupportedError.
    return liveTempUris.has(uri) ? { url: uri, revoke: false } : null;
  }
  return { url: uri, revoke: false };
}

/** Deletes a recording's stored audio (no-op for anything that isn't an `idb:` URI). */
export function deleteWebAudio(uri: string | null | undefined): void {
  if (!uri || !isStoredWebAudio(uri)) return;
  run('readwrite', (s) => s.delete(uri.slice(PREFIX.length))).catch(() => {});
}
