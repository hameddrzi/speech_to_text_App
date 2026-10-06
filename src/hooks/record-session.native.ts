import LiveAudioStream from '@fugood/react-native-audio-pcm-stream';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';

import { smoothLevel } from '@/components/record/waveform-utils';
import type {
  FinishedRecording,
  MicPermission,
  RecordPhase,
  StartOptions,
  WaveSample,
} from '@/hooks/record-session';
import { LiveTranscriber } from '@/stt/live-transcriber';
import { isModelDownloaded } from '@/stt/model-files';
import { base64ToBytes, pcmLevel, SAMPLE_RATE } from '@/stt/pcm';
import { WavWriter } from '@/stt/wav-writer';

export type { FinishedRecording, MicPermission, RecordPhase, StartOptions, WaveSample };

/** Sampling interval for timer + waveform. One bar is appended per tick. */
export const RECORD_TICK_MS = 60;
const MAX_VISIBLE_SAMPLES = 180;

/**
 * Native recording session: raw 16 kHz mono PCM from the microphone feeds three things at once —
 * the live waveform (RMS level), a WAV file on disk (for playback + the accurate final transcript),
 * and the rolling on-device Whisper preview shown in the Live Transcript card.
 */
export function useRecordSession() {
  const [phase, setPhase] = useState<RecordPhase>('idle');
  const [permission, setPermission] = useState<MicPermission>('undetermined');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [samples, setSamples] = useState<WaveSample[]>([]);
  const [liveText, setLiveText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const accumulatedRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const levelsRef = useRef<number[]>([]);
  const smoothRef = useRef(0);
  const latestLevelRef = useRef(0);
  const counterRef = useRef(0);
  const writerRef = useRef<WavWriter | null>(null);
  const liveRef = useRef<LiveTranscriber | null>(null);
  const capturingRef = useRef(false);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);

  const currentElapsed = useCallback(() => {
    const seg = segmentStartRef.current;
    return accumulatedRef.current + (seg != null ? Date.now() - seg : 0);
  }, []);

  const resetSession = useCallback(() => {
    accumulatedRef.current = 0;
    segmentStartRef.current = null;
    levelsRef.current = [];
    smoothRef.current = 0;
    latestLevelRef.current = 0;
    setElapsedMs(0);
    setSamples([]);
  }, []);

  // Sampling loop: timer + one waveform bar per tick while recording.
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => {
      const v = smoothLevel(smoothRef.current, latestLevelRef.current);
      smoothRef.current = v;
      levelsRef.current.push(v);
      counterRef.current += 1;
      const sample = { id: counterRef.current, v };
      setElapsedMs(currentElapsed());
      setSamples((prev) => {
        const next =
          prev.length >= MAX_VISIBLE_SAMPLES ? prev.slice(prev.length - MAX_VISIBLE_SAMPLES + 1) : prev.slice();
        next.push(sample);
        return next;
      });
    }, RECORD_TICK_MS);
    return () => clearInterval(id);
  }, [phase, currentElapsed]);

  const stopStream = useCallback(async () => {
    capturingRef.current = false;
    try {
      await LiveAudioStream.stop();
    } catch {}
  }, []);

  // Never leave the microphone open if the screen unmounts mid-take.
  useEffect(
    () => () => {
      capturingRef.current = false;
      subscriptionRef.current?.remove();
      liveRef.current?.stop();
      writerRef.current?.discard();
      try {
        LiveAudioStream.stop();
      } catch {}
    },
    [],
  );

  const start = useCallback(
    async (opts: StartOptions): Promise<boolean> => {
      if (phase !== 'idle') return false;
      setPhase('starting');
      setError(null);
      setLiveText('');

      try {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) {
          setPermission(perm.canAskAgain ? 'denied' : 'blocked');
          setPhase('idle');
          return false;
        }
        setPermission('granted');

        writerRef.current = new WavWriter(opts.id);
        // Without a downloaded model there is nothing to run; the screen shows a hint instead of an error.
        liveRef.current =
          opts.liveTranscript && isModelDownloaded(opts.model)
          ? new LiveTranscriber(
              { model: opts.model },
              setLiveText,
              (e) => setError(e.message),
            )
          : null;

        await LiveAudioStream.init({
          sampleRate: SAMPLE_RATE,
          channels: 1,
          bitsPerSample: 16,
          audioSource: 6,
          bufferSize: 2048,
          wavFile: '',
        });
        subscriptionRef.current?.remove();
        subscriptionRef.current = LiveAudioStream.on('data', (b64) => {
          if (!capturingRef.current) return;
          const pcm = base64ToBytes(b64);
          latestLevelRef.current = pcmLevel(pcm);
          writerRef.current?.append(pcm);
          liveRef.current?.push(pcm);
        });

        resetSession();
        capturingRef.current = true;
        LiveAudioStream.start();
        liveRef.current?.start();
        segmentStartRef.current = Date.now();
        setPhase('recording');
        return true;
      } catch (e) {
        writerRef.current?.discard();
        writerRef.current = null;
        liveRef.current = null;
        setError(e instanceof Error ? e.message : 'Could not start recording');
        setPhase('idle');
        return false;
      }
    },
    [phase, resetSession],
  );

  const pause = useCallback(() => {
    if (phase !== 'recording') return;
    stopStream();
    liveRef.current?.pause();
    accumulatedRef.current = currentElapsed();
    segmentStartRef.current = null;
    latestLevelRef.current = 0;
    setElapsedMs(accumulatedRef.current);
    setPhase('paused');
  }, [phase, currentElapsed, stopStream]);

  const resume = useCallback(() => {
    if (phase !== 'paused') return;
    capturingRef.current = true;
    LiveAudioStream.start();
    liveRef.current?.start();
    segmentStartRef.current = Date.now();
    setPhase('recording');
  }, [phase]);

  /** Stops the session and hands back everything needed to build a `Recording`. */
  const stop = useCallback(async (): Promise<FinishedRecording | null> => {
    if (phase !== 'recording' && phase !== 'paused') return null;
    setPhase('saving');
    await stopStream();
    const levels = levelsRef.current.slice();
    const writer = writerRef.current;
    const durationMs = writer ? Math.round(writer.seconds * 1000) : currentElapsed();
    const uri = writer ? writer.finish() : null;
    writerRef.current = null;
    liveRef.current?.stop();
    liveRef.current = null;
    setLiveText('');
    resetSession();
    setPhase('idle');
    return { uri, durationMs, levels };
  }, [phase, currentElapsed, stopStream, resetSession]);

  /** Stops and throws the take away (including its file). */
  const discard = useCallback(async () => {
    if (phase !== 'recording' && phase !== 'paused') return;
    setPhase('saving');
    await stopStream();
    writerRef.current?.discard();
    writerRef.current = null;
    liveRef.current?.stop();
    liveRef.current = null;
    setLiveText('');
    resetSession();
    setPhase('idle');
  }, [phase, stopStream, resetSession]);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  const dismissPermission = useCallback(() => setPermission('undetermined'), []);

  return {
    phase,
    permission,
    elapsedMs,
    samples,
    liveText,
    simulated: false,
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
