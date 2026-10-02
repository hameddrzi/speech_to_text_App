import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { dbToLevel, simulatedLevel, smoothLevel } from '@/components/record/waveform-utils';
import type { SpeechModel } from '@/stt/models';
import type { SttLanguage } from '@/stt/types';

export type RecordPhase = 'idle' | 'starting' | 'recording' | 'paused' | 'saving';
export type MicPermission = 'undetermined' | 'granted' | 'denied' | 'blocked';

export type WaveSample = { id: number; v: number };

export type StartOptions = {
  /** Recording id; the native recorder names its WAV file after it. */
  id: string;
  language: SttLanguage;
  model: SpeechModel;
  /** Run the rolling on-device Whisper preview while recording (native only). */
  liveTranscript: boolean;
};

export type FinishedRecording = {
  uri: string | null;
  durationMs: number;
  /** Every 0–1 level collected during the session (one per tick). */
  levels: number[];
};

/** Sampling interval for timer + waveform. One bar is appended per tick. */
export const RECORD_TICK_MS = 60;
/** Upper bound on bars kept in state for the live waveform (plenty for tablets). */
const MAX_VISIBLE_SAMPLES = 180;

const RECORDING_OPTIONS: RecordingOptions = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/**
 * Web recording session (the native app uses record-session.native.ts with raw PCM + on-device Whisper).
 * Owns permission, the expo-audio recorder, timer and metering → waveform samples, and falls back to a
 * simulated meter when the browser can't record, so the UI still demos. No live transcript on web.
 */
export function useRecordSession() {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);

  const [phase, setPhase] = useState<RecordPhase>('idle');
  const [permission, setPermission] = useState<MicPermission>('undetermined');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [samples, setSamples] = useState<WaveSample[]>([]);
  const [simulated, setSimulated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accumulatedRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const levelsRef = useRef<number[]>([]);
  const smoothRef = useRef(0);
  const counterRef = useRef(0);
  const simulatedRef = useRef(false);

  const currentElapsed = useCallback(() => {
    const seg = segmentStartRef.current;
    return accumulatedRef.current + (seg != null ? Date.now() - seg : 0);
  }, []);

  const resetSession = useCallback(() => {
    accumulatedRef.current = 0;
    segmentStartRef.current = null;
    levelsRef.current = [];
    smoothRef.current = 0;
    setElapsedMs(0);
    setSamples([]);
  }, []);

  // Sampling loop: timer + one waveform bar per tick while recording.
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => {
      const elapsed = currentElapsed();
      let raw: number;
      if (simulatedRef.current) {
        raw = simulatedLevel(elapsed);
      } else {
        let metering: number | undefined;
        try {
          metering = recorder.getStatus().metering;
        } catch {
          metering = undefined;
        }
        raw = metering === undefined ? simulatedLevel(elapsed) : dbToLevel(metering);
      }
      const v = smoothLevel(smoothRef.current, raw);
      smoothRef.current = v;
      levelsRef.current.push(v);
      counterRef.current += 1;
      const sample = { id: counterRef.current, v };

      setElapsedMs(elapsed);
      setSamples((prev) => {
        const next = prev.length >= MAX_VISIBLE_SAMPLES ? prev.slice(prev.length - MAX_VISIBLE_SAMPLES + 1) : prev.slice();
        next.push(sample);
        return next;
      });
    }, RECORD_TICK_MS);
    return () => clearInterval(id);
  }, [phase, recorder, currentElapsed]);

  const start = useCallback(async (_opts?: StartOptions): Promise<boolean> => {
    if (phase !== 'idle') return false;
    setPhase('starting');
    setError(null);
    let sim = false;

    try {
      const perm = await requestRecordingPermissionsAsync();
      if (perm.granted) {
        setPermission('granted');
      } else if (Platform.OS === 'web') {
        sim = true;
      } else {
        setPermission(perm.canAskAgain ? 'denied' : 'blocked');
        setPhase('idle');
        return false;
      }

      if (!sim) {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
    } catch (e) {
      if (Platform.OS === 'web') {
        sim = true;
      } else {
        setError(e instanceof Error ? e.message : 'Could not start recording');
        setPhase('idle');
        return false;
      }
    }

    simulatedRef.current = sim;
    setSimulated(sim);
    resetSession();
    segmentStartRef.current = Date.now();
    setPhase('recording');
    return true;
  }, [phase, recorder, resetSession]);

  const pause = useCallback(() => {
    if (phase !== 'recording') return;
    if (!simulatedRef.current) {
      try {
        recorder.pause();
      } catch {}
    }
    accumulatedRef.current = currentElapsed();
    segmentStartRef.current = null;
    setElapsedMs(accumulatedRef.current);
    setPhase('paused');
  }, [phase, recorder, currentElapsed]);

  const resume = useCallback(() => {
    if (phase !== 'paused') return;
    if (!simulatedRef.current) {
      try {
        recorder.record();
      } catch {}
    }
    segmentStartRef.current = Date.now();
    setPhase('recording');
  }, [phase, recorder]);

  const finishRecorder = useCallback(async (): Promise<string | null> => {
    if (simulatedRef.current) return null;
    try {
      await recorder.stop();
    } catch {}
    const uri = recorder.uri ?? null;
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    return uri;
  }, [recorder]);

  /** Stops the session and hands back everything needed to build a `Recording`. */
  const stop = useCallback(async (): Promise<FinishedRecording | null> => {
    if (phase !== 'recording' && phase !== 'paused') return null;
    const durationMs = currentElapsed();
    const levels = levelsRef.current.slice();
    segmentStartRef.current = null;
    setPhase('saving');
    const uri = await finishRecorder();
    resetSession();
    setPhase('idle');
    return { uri, durationMs, levels };
  }, [phase, currentElapsed, finishRecorder, resetSession]);

  /** Stops and throws the take away. */
  const discard = useCallback(async () => {
    if (phase !== 'recording' && phase !== 'paused') return;
    segmentStartRef.current = null;
    setPhase('saving');
    await finishRecorder();
    resetSession();
    setPhase('idle');
  }, [phase, finishRecorder, resetSession]);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  const dismissPermission = useCallback(() => setPermission('undetermined'), []);

  return {
    phase,
    permission,
    elapsedMs,
    samples,
    liveText: '',
    simulated,
    error,
    start,
    pause,
    resume,
    stop,
    discard,
    openSettings,
    dismissPermission,
  };
}
