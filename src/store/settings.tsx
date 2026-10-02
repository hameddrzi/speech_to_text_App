import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { formatBytes, MODELS, type SpeechModel } from '@/stt/models';
import type { SttLanguage } from '@/stt/types';
import { readJSON, writeJSON } from '@/utils/storage';

export type { SpeechModel };

/**
 * App settings — one typed object shared through <SettingsProvider> and persisted to disk.
 * The recorder and the on-device speech-to-text engine read it via useSettings().
 */

export type TranscriptionLanguage = SttLanguage;
export type AudioQuality = 'standard' | 'high' | 'lossless';
export type AutoDeletePolicy = 'never' | '30d' | '1y';

export type AppSettings = {
  /** Language passed to the on-device Whisper model; 'auto' lets the model detect it. */
  language: TranscriptionLanguage;
  /** Which Whisper checkpoint to load on device. */
  speechModel: SpeechModel;
  /** Stream partial transcript while recording. */
  liveTranscript: boolean;
  /** Restore punctuation / casing in the final transcript. */
  autoPunctuation: boolean;
  /** Recorder encoding preset. */
  audioQuality: AudioQuality;
  /** Trim long silences (VAD) before transcription / in playback. */
  skipSilence: boolean;
  /** Haptic feedback across the app. */
  haptics: boolean;
  /** Auto-delete recordings older than this. */
  autoDelete: AutoDeletePolicy;
};

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'auto',
  speechModel: 'small',
  liveTranscript: true,
  autoPunctuation: true,
  audioQuality: 'high',
  skipSilence: false,
  haptics: true,
  autoDelete: 'never',
};

export type Option<T extends string> = { value: T; label: string; detail?: string; rtl?: boolean };

export const LANGUAGE_OPTIONS: Option<TranscriptionLanguage>[] = [
  { value: 'fa', label: 'فارسی', rtl: true },
  { value: 'en', label: 'English' },
  { value: 'it', label: 'Italiano' },
  { value: 'auto', label: 'Auto' },
];

/** Whisper checkpoints offered in the UI, sized from the real model files. */
export const SPEECH_MODELS: (Option<SpeechModel> & { sizeMB: number; hint: string })[] = MODELS.map((m) => ({
  value: m.value,
  label: m.label,
  sizeMB: Math.round(m.bytes / 1e6),
  hint: m.hint,
  detail: formatBytes(m.bytes),
}));

/** Encoding presets; `bytesPerSecond` is used to estimate storage. */
export const AUDIO_QUALITIES: (Option<AudioQuality> & { bytesPerSecond: number })[] = [
  { value: 'standard', label: 'Standard', detail: 'AAC · 64 kbps · smallest files', bytesPerSecond: 8_000 },
  { value: 'high', label: 'High', detail: 'AAC · 128 kbps · recommended', bytesPerSecond: 16_000 },
  { value: 'lossless', label: 'Lossless', detail: 'WAV · 48 kHz · large files', bytesPerSecond: 96_000 },
];

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

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...readJSON<Partial<AppSettings>>(STORAGE_KEY),
  }));

  useEffect(() => {
    writeJSON(STORAGE_KEY, settings);
  }, [settings]);

  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
