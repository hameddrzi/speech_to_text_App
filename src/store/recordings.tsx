import { File } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, AppState, Platform } from 'react-native';

import { MOCK_RECORDINGS, type Recording } from '@/data/recordings';
import { useSettings, type AutoDeletePolicy } from '@/store/settings';
import { resolveRecordingUri, stripVolatileFields } from '@/utils/recording-files';
import { readJSONWithStatus, writeRawJSON } from '@/utils/storage';
import { deleteWebAudio } from '@/utils/web-audio';

type RecordingsContextValue = {
  recordings: Recording[];
  getById: (id: string) => Recording | undefined;
  addRecording: (r: Recording) => void;
  updateRecording: (id: string, patch: Partial<Recording>) => void;
  deleteRecording: (id: string) => void;
  toggleFavorite: (id: string) => void;
  /**
   * Writes the latest *committed* recordings to disk right away instead of waiting for the debounce.
   * Call it before heavy native work; a state update made in the same tick is persisted by the next write.
   */
  flush: () => void;
};

const RecordingsContext = createContext<RecordingsContextValue | null>(null);

const STORAGE_KEY = 'recordings';
/** Writes are batched: at most one every WRITE_DELAY_MS (trailing), plus an immediate flush on background. */
const WRITE_DELAY_MS = 400;
const DAY_MS = 86_400_000;
const MAX_AGE: Record<AutoDeletePolicy, number> = { never: Infinity, '30d': 30 * DAY_MS, '1y': 365 * DAY_MS };

function deleteAudio(uri: string | null) {
  if (Platform.OS === 'web') {
    deleteWebAudio(uri);
    return;
  }
  const resolved = resolveRecordingUri(uri);
  if (!resolved) return;
  try {
    const f = new File(resolved);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}

/** Applies the Profile → Storage auto-delete policy (favorites are always kept). */
function pruneExpired(recordings: Recording[], policy: AutoDeletePolicy): Recording[] {
  const cutoff = Date.now() - MAX_AGE[policy];
  const expired = recordings.filter((r) => !r.favorite && new Date(r.createdAt).getTime() < cutoff);
  expired.forEach((r) => deleteAudio(r.uri));
  return expired.length ? recordings.filter((r) => !expired.includes(r)) : recordings;
}

/** What goes into recordings.json: everything except volatile `*Progress` fields. */
function serialize(recordings: Recording[]): string {
  return JSON.stringify(recordings.map(stripVolatileFields));
}

type Loaded = {
  recordings: Recording[];
  /** Set when the data came from a backup or an unreadable file was set aside (shown once). */
  recoveryNotice: string | null;
};

function loadRecordings(policy: AutoDeletePolicy): Loaded {
  const { value: saved, source, corrupt } = readJSONWithStatus<Recording[]>(STORAGE_KEY, Array.isArray);
  const recoveryNotice =
    source === 'backup' || source === 'temp'
      ? 'Your recordings were restored from a backup because the saved data was damaged or incomplete.'
      : corrupt
        ? 'Saved recording data could not be read. A copy was kept on the device and the archive starts fresh.'
        : null;
  if (saved) {
    // A transcription that was running when the app closed is picked up again by the worker (progress is not
    // persisted). Older versions also stored a per-recording language; the app is English-only now.
    // Audio URIs are re-pointed at this install's recordings folder (the iOS container path changes on update);
    // the rebased URIs are written back by the first save.
    const restored = saved.map(({ language: _language, ...r }: Recording & { language?: unknown }) =>
      stripVolatileFields({ ...r, uri: resolveRecordingUri(r.uri) }),
    );
    return { recordings: pruneExpired(restored, policy), recoveryNotice };
  }
  // The web build is a UI preview, so it starts with sample recordings; the phone app starts empty.
  return { recordings: Platform.OS === 'web' ? MOCK_RECORDINGS : [], recoveryNotice };
}

/**
 * Recordings live in documents/recordings.json (metadata + transcripts) and documents/recordings/*.wav (audio).
 * recordings.json is written atomically (see src/utils/storage.ts) and debounced; call flush() to force a write.
 * The recorder calls addRecording() on stop; the transcription worker fills the transcript via updateRecording().
 */
export function RecordingsProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  // Auto-delete runs once per launch, so a policy change applies the next time the app starts.
  const [loaded] = useState<Loaded>(() => loadRecordings(settings.autoDelete));
  const [recordings, setRecordings] = useState<Recording[]>(loaded.recordings);

  // Persistence: a trailing write at most every WRITE_DELAY_MS (progress ticks don't hammer the disk),
  // skipped when nothing persistent changed, and flushed right away when the app leaves the foreground.
  const latest = useRef(recordings);
  const lastWritten = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const raw = serialize(latest.current);
    if (raw === lastWritten.current) return;
    writeRawJSON(STORAGE_KEY, raw);
    lastWritten.current = raw;
  }, []);

  useEffect(() => {
    latest.current = recordings;
    timer.current ??= setTimeout(flush, WRITE_DELAY_MS);
  }, [recordings, flush]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') flush();
    });
    return () => {
      sub.remove();
      flush();
    };
  }, [flush]);

  useEffect(() => {
    if (loaded.recoveryNotice) Alert.alert('Recordings recovered', loaded.recoveryNotice);
  }, [loaded]);

  const getById = useCallback((id: string) => recordings.find((r) => r.id === id), [recordings]);

  const addRecording = useCallback((r: Recording) => setRecordings((prev) => [r, ...prev]), []);

  const updateRecording = useCallback(
    (id: string, patch: Partial<Recording>) =>
      setRecordings((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    [],
  );

  const deleteRecording = useCallback(
    (id: string) =>
      setRecordings((prev) => {
        deleteAudio(prev.find((r) => r.id === id)?.uri ?? null);
        return prev.filter((r) => r.id !== id);
      }),
    [],
  );

  const toggleFavorite = useCallback(
    (id: string) =>
      setRecordings((prev) => prev.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r))),
    [],
  );

  const value = useMemo(
    () => ({ recordings, getById, addRecording, updateRecording, deleteRecording, toggleFavorite, flush }),
    [recordings, getById, addRecording, updateRecording, deleteRecording, toggleFavorite, flush],
  );

  return <RecordingsContext.Provider value={value}>{children}</RecordingsContext.Provider>;
}

export function useRecordings() {
  const ctx = useContext(RecordingsContext);
  if (!ctx) throw new Error('useRecordings must be used inside RecordingsProvider');
  return ctx;
}
