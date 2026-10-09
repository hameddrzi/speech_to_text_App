import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { formatBytes, MODELS, type SpeechModel } from '@/stt/models';
import { setHapticsEnabled } from '@/utils/haptics';
import { readJSONWithStatus, writeJSON } from '@/utils/storage';

export type { SpeechModel };

/**
 * App settings — one typed object shared through <SettingsProvider> and persisted to disk.
 * The recorder and the on-device speech-to-text engine read it via useSettings().
 */

export type AutoDeletePolicy = 'never' | '30d' | '1y';

export type AppSettings = {
  /** Shown on the Profile tab; empty until the user sets it. */
  displayName: string;
  /** Which Whisper checkpoint to load on device. */
  speechModel: SpeechModel;
  /** Stream partial transcript while recording. */
  liveTranscript: boolean;
  /** Haptic feedback across the app. */
  haptics: boolean;
  /** Auto-delete recordings older than this. */
  autoDelete: AutoDeletePolicy;
};

export const DEFAULT_SETTINGS: AppSettings = {
  displayName: '',
  speechModel: 'small',
  liveTranscript: true,
  haptics: true,
  autoDelete: 'never',
};

export type Option<T extends string> = { value: T; label: string; detail?: string };

/** Whisper checkpoints offered in the UI, sized from the real model files. */
export const SPEECH_MODELS: (Option<SpeechModel> & { sizeMB: number; hint: string })[] = MODELS.map((m) => ({
  value: m.value,
  label: m.label,
  sizeMB: Math.round(m.bytes / 1e6),
  hint: m.hint,
  detail: formatBytes(m.bytes),
}));

export const AUTO_DELETE_OPTIONS: Option<AutoDeletePolicy>[] = [
  { value: 'never', label: 'Never' },
  { value: '30d', label: 'After 30 Days' },
  { value: '1y', label: 'After 1 Year' },
];

export function optionLabel<T extends string>(options: Option<T>[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

type SettingsContextValue = {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  reset: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_KEY = 'settings';

const isPlainObject = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Saved settings on top of the defaults. Keys from older versions (or of the wrong type) are dropped.
 * settings.json is written atomically; a damaged file is kept aside and the backup used (see storage.ts).
 */
function loadSettings(): AppSettings {
  const saved = readJSONWithStatus<Record<string, unknown>>(STORAGE_KEY, isPlainObject).value ?? {};
  const settings: AppSettings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
    if (typeof saved[key] === typeof DEFAULT_SETTINGS[key]) Object.assign(settings, { [key]: saved[key] });
  }
  if (!MODELS.some((m) => m.value === settings.speechModel)) settings.speechModel = DEFAULT_SETTINGS.speechModel;
  if (!AUTO_DELETE_OPTIONS.some((o) => o.value === settings.autoDelete)) settings.autoDelete = DEFAULT_SETTINGS.autoDelete;
  return settings;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = loadSettings();
    setHapticsEnabled(loaded.haptics);
    return loaded;
  });

  useEffect(() => {
    writeJSON(STORAGE_KEY, settings);
  }, [settings]);

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    // Applied right away so the toggle's own feedback already follows the new value.
    if (key === 'haptics') setHapticsEnabled(value as boolean);
    setSettings((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setHapticsEnabled(DEFAULT_SETTINGS.haptics);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
