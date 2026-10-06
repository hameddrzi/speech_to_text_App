import { File } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { MOCK_RECORDINGS, type Recording } from '@/data/recordings';
import { useSettings, type AutoDeletePolicy } from '@/store/settings';
import { readJSON, writeJSON } from '@/utils/storage';

type RecordingsContextValue = {
  recordings: Recording[];
  getById: (id: string) => Recording | undefined;
  addRecording: (r: Recording) => void;
  updateRecording: (id: string, patch: Partial<Recording>) => void;
  deleteRecording: (id: string) => void;
  toggleFavorite: (id: string) => void;
};

const RecordingsContext = createContext<RecordingsContextValue | null>(null);

const STORAGE_KEY = 'recordings';
const DAY_MS = 86_400_000;
const MAX_AGE: Record<AutoDeletePolicy, number> = { never: Infinity, '30d': 30 * DAY_MS, '1y': 365 * DAY_MS };

function deleteAudio(uri: string | null) {
  if (!uri || Platform.OS === 'web') return;
  try {
    const f = new File(uri);
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

function loadRecordings(policy: AutoDeletePolicy): Recording[] {
  const saved = readJSON<Recording[]>(STORAGE_KEY);
  if (saved) {
    // A transcription that was running when the app closed is picked up again by the worker.
    // Older versions also stored a per-recording language; the app is English-only now.
    const restored = saved.map(({ language: _language, ...r }: Recording & { language?: unknown }) =>
      r.transcriptStatus === 'processing' ? { ...r, transcriptProgress: undefined } : r,
    );
    return pruneExpired(restored, policy);
  }
  // The web build is a UI preview, so it starts with sample recordings; the phone app starts empty.
  return Platform.OS === 'web' ? MOCK_RECORDINGS : [];
}

/**
 * Recordings live in documents/recordings.json (metadata + transcripts) and documents/recordings/*.wav (audio).
 * The recorder calls addRecording() on stop; the transcription worker fills the transcript via updateRecording().
 */
export function RecordingsProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  // Auto-delete runs once per launch, so a policy change applies the next time the app starts.
  const [recordings, setRecordings] = useState<Recording[]>(() => loadRecordings(settings.autoDelete));

  useEffect(() => {
    writeJSON(STORAGE_KEY, recordings);
  }, [recordings]);

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
    () => ({ recordings, getById, addRecording, updateRecording, deleteRecording, toggleFavorite }),
    [recordings, getById, addRecording, updateRecording, deleteRecording, toggleFavorite],
  );

  return <RecordingsContext.Provider value={value}>{children}</RecordingsContext.Provider>;
}

export function useRecordings() {
  const ctx = useContext(RecordingsContext);
  if (!ctx) throw new Error('useRecordings must be used inside RecordingsProvider');
  return ctx;
}
