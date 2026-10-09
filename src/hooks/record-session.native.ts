import LiveAudioStream from '@fugood/react-native-audio-pcm-stream';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, type AppStateStatus } from 'react-native';

import { smoothLevel } from '@/components/record/waveform-utils';
import { useBackgroundCapture, type BackgroundSupport } from '@/hooks/background-capture';
import type {
  FinishedRecording,
  MicPermission,
  RecordPhase,
  SessionOptions,
  StartOptions,
  WaveSample,
} from '@/hooks/record-session';
import { LiveTranscriber } from '@/stt/live-transcriber';
import { isModelDownloaded } from '@/stt/model-files';
import { base64ToBytes, pcmLevel, SAMPLE_RATE } from '@/stt/pcm';
import { WavWriter } from '@/stt/wav-writer';

export type { FinishedRecording, MicPermission, RecordPhase, SessionOptions, StartOptions, WaveSample };

/** Sampling interval for timer + waveform. One bar is appended per tick. */
export const RECORD_TICK_MS = 60;
const MAX_VISIBLE_SAMPLES = 180;
/**
 * On Android, stop() only flags the native read loop; the recorder is released a moment later on its own
 * thread. A new init() inside that window would have its recorder nulled out, so the next init waits it out.
 */
const NATIVE_RELEASE_MS = 250;
/** No chunk from the microphone for this long (while in the foreground) means the stream died. */
const STALL_MS = 3000;
const WATCHDOG_MS = 2000;
const KEEP_AWAKE_TAG = 'voice-recording';

const STREAM_CONFIG = {
  sampleRate: SAMPLE_RATE,
  channels: 1,
  bitsPerSample: 16,
  audioSource: 6, // Android VOICE_RECOGNITION
  bufferSize: 2048,
  wavFile: '',
} as const;

const NOTICE_FOREGROUND_ONLY = 'Keep Voice open while recording';
const NOTICE_GAP = 'Audio may be missing while in background';
const NOTICE_RESTARTED = 'Microphone restarted after an interruption';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Native recording session: raw 16 kHz mono PCM from the microphone feeds three things at once —
 * the live waveform (RMS level), a WAV file on disk (for playback + the accurate final transcript),
 * and the rolling on-device Whisper preview shown in the Live Transcript card.
 *
 * While a take is active the screen is kept awake, and on Android a microphone foreground service keeps
 * capture going with the screen locked or the app in the background (see background-capture.android.ts).
 * A take is never thrown away unless the user discards it: if the screen unmounts mid-take, it is
 * finished and handed to `onAutoStop`.
 */
export function useRecordSession(options: SessionOptions = {}) {
  const [phase, setPhase] = useState<RecordPhase>('idle');
  const [permission, setPermission] = useState<MicPermission>('undetermined');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [samples, setSamples] = useState<WaveSample[]>([]);
  const [liveText, setLiveText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
  /** When the native recorder from the previous stop() is certainly released. */
  const releasedAtRef = useRef(0);
  const lastChunkAtRef = useRef(0);
  const restartingRef = useRef(false);
  const supportRef = useRef<BackgroundSupport>('unavailable');
  const backgroundSinceRef = useRef<number | null>(null);

  const onAutoStopRef = useRef(options.onAutoStop);
  const stopRef = useRef<() => Promise<FinishedRecording | null>>(async () => null);
  useEffect(() => {
    onAutoStopRef.current = options.onAutoStop;
  });

  // Android: "Stop" in the recording notification ends the take like the Stop button, and saves it.
  const background = useBackgroundCapture(() => {
    stopRef
      .current()
      .then((result) => {
        if (result) onAutoStopRef.current?.(result);
      })
      .catch(() => {});
  });
  const backgroundRef = useRef(background);
  useEffect(() => {
    backgroundRef.current = background;
  });

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

  /** Flags the native stream to stop. Doesn't wait (JS timers don't run in the background on Android). */
  const stopStream = useCallback(() => {
    capturingRef.current = false;
    try {
      LiveAudioStream.stop();
    } catch {}
    releasedAtRef.current = Date.now() + NATIVE_RELEASE_MS;
  }, []);

  /** init + start, after the previous native recorder is released. */
  const openStream = useCallback(async () => {
    const remaining = releasedAtRef.current - Date.now();
    if (remaining > 0) await wait(remaining);
    await LiveAudioStream.init(STREAM_CONFIG);
    LiveAudioStream.start();
    lastChunkAtRef.current = Date.now();
  }, []);

  const isActive = phase === 'recording' || phase === 'paused';

  // Watchdog: if the microphone stops delivering (iOS audio interruption such as a phone call, or the
  // Android read loop dying), reopen the stream. Only in the foreground: JS timers don't run in the
  // background on Android, and iOS doesn't allow starting capture from the background.
  useEffect(() => {
    if (!isActive) return;
    const restartIfStalled = async () => {
      if (restartingRef.current || AppState.currentState !== 'active') return;
      if (Date.now() - lastChunkAtRef.current < STALL_MS) return;
      restartingRef.current = true;
      console.warn('[record] microphone stalled, restarting the stream');
      try {
        const capturing = capturingRef.current;
        stopStream();
        capturingRef.current = capturing;
        await openStream();
        setNotice(NOTICE_RESTARTED);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'The microphone stopped');
      } finally {
        restartingRef.current = false;
      }
    };
    const id = setInterval(() => void restartIfStalled(), WATCHDOG_MS);
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        const since = backgroundSinceRef.current;
        backgroundSinceRef.current = null;
        if (since != null) {
          const seconds = Math.round((Date.now() - since) / 1000);
          console.info(`[record] back in the foreground after ${seconds}s (background capture: ${supportRef.current})`);
          // Without the foreground service Android hands the app silence while it's in the background.
          if (Platform.OS === 'android' && supportRef.current !== 'active' && seconds > 0) setNotice(NOTICE_GAP);
        }
        void restartIfStalled();
      } else if (backgroundSinceRef.current == null) {
        backgroundSinceRef.current = Date.now();
        console.info(`[record] app went to the ${state} while recording`);
      }
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [isActive, stopStream, openStream]);

  /** Releases everything a take holds except its file. */
  const releaseTake = useCallback(() => {
    liveRef.current?.stop();
    liveRef.current = null;
    deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    void backgroundRef.current.end();
    backgroundSinceRef.current = null;
  }, []);

  // If the screen unmounts mid-take (e.g. Android recreates the Activity), finish the file and hand the
  // take over instead of losing it. If nobody takes it, orphan recovery adds it on the next launch.
  useEffect(
    () => () => {
      capturingRef.current = false;
      subscriptionRef.current?.remove();
      try {
        LiveAudioStream.stop();
      } catch {}
      releaseTake();
      const writer = writerRef.current;
      writerRef.current = null;
      if (!writer) return;
      try {
        const durationMs = Math.round(writer.seconds * 1000);
        const uri = writer.finish();
        onAutoStopRef.current?.({ uri, durationMs, levels: levelsRef.current.slice() });
      } catch (e) {
        console.warn('[record] could not finish the take on unmount', e);
      }
    },
    [releaseTake],
  );

  const start = useCallback(
    async (opts: StartOptions): Promise<boolean> => {
      if (phase !== 'idle') return false;
      setPhase('starting');
      setError(null);
      setNotice(null);
      setLiveText('');

      try {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) {
          setPermission(perm.canAskAgain ? 'denied' : 'blocked');
          setPhase('idle');
          return false;
        }
        setPermission('granted');

        // Before the microphone opens, so the foreground service starts while the app is in front.
        const support = await backgroundRef.current.begin();
        supportRef.current = support;
        if (Platform.OS === 'android' && support !== 'active') setNotice(NOTICE_FOREGROUND_ONLY);

        writerRef.current = new WavWriter(opts.id);
        // Without a downloaded model there is nothing to run; the screen shows a hint instead of an error.
        liveRef.current =
          opts.liveTranscript && isModelDownloaded(opts.model)
            ? new LiveTranscriber({ model: opts.model }, setLiveText, (e) => setError(e.message))
            : null;

        subscriptionRef.current?.remove();
        subscriptionRef.current = LiveAudioStream.on('data', (b64) => {
          lastChunkAtRef.current = Date.now();
          if (!capturingRef.current) return;
          const pcm = base64ToBytes(b64);
          latestLevelRef.current = pcmLevel(pcm);
          writerRef.current?.append(pcm);
          liveRef.current?.push(pcm);
        });

        resetSession();
        capturingRef.current = true;
        await openStream();
        liveRef.current?.start();
        activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
        segmentStartRef.current = Date.now();
        setPhase('recording');
        return true;
      } catch (e) {
        capturingRef.current = false;
        writerRef.current?.discard();
        writerRef.current = null;
        releaseTake();
        setError(e instanceof Error ? e.message : 'Could not start recording');
        setPhase('idle');
        return false;
      }
    },
    [phase, resetSession, openStream, releaseTake],
  );

  // Pausing keeps the native stream open and just drops its chunks: on Android, stop() releases the
  // recorder, so a later start() would silently capture nothing.
  const pause = useCallback(() => {
    if (phase !== 'recording') return;
    capturingRef.current = false;
    liveRef.current?.pause();
    accumulatedRef.current = currentElapsed();
    segmentStartRef.current = null;
    latestLevelRef.current = 0;
    setElapsedMs(accumulatedRef.current);
    setPhase('paused');
  }, [phase, currentElapsed]);

  const resume = useCallback(() => {
    if (phase !== 'paused') return;
    capturingRef.current = true;
    liveRef.current?.start();
    segmentStartRef.current = Date.now();
    setPhase('recording');
  }, [phase]);

  /** Stops the session and hands back everything needed to build a `Recording`. */
  const stop = useCallback(async (): Promise<FinishedRecording | null> => {
    if (phase !== 'recording' && phase !== 'paused') return null;
    setPhase('saving');
    stopStream();
    const levels = levelsRef.current.slice();
    const writer = writerRef.current;
    writerRef.current = null;
    const durationMs = writer ? Math.round(writer.seconds * 1000) : currentElapsed();
    const uri = writer ? writer.finish() : null;
    releaseTake();
    setLiveText('');
    setNotice(null);
    resetSession();
    setPhase('idle');
    return { uri, durationMs, levels };
  }, [phase, currentElapsed, stopStream, resetSession, releaseTake]);

  useEffect(() => {
    stopRef.current = stop;
  });

  /** Stops and throws the take away (including its file). */
  const discard = useCallback(async () => {
    if (phase !== 'recording' && phase !== 'paused') return;
    setPhase('saving');
    stopStream();
    writerRef.current?.discard();
    writerRef.current = null;
    releaseTake();
    setLiveText('');
    setNotice(null);
    resetSession();
    setPhase('idle');
  }, [phase, stopStream, resetSession, releaseTake]);

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
    notice,
    start,
    pause,
    resume,
    stop,
    discard,
    openSettings,
    dismissPermission,
  };
}
