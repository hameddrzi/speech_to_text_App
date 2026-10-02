import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Recording } from '@/data/recordings';

export const PLAYBACK_RATES = [1, 1.5, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

/** Seconds jumped by the ±15 buttons. */
export const SKIP_SECONDS = 15;

/** Tick of the simulated clock used for mock recordings (uri === null). */
const SIM_TICK_MS = 50;
/** How often expo-audio reports status for real files. */
const STATUS_INTERVAL_MS = 100;

export type Playback = {
  /** Current position in seconds. */
  position: number;
  /** Total length in seconds. */
  duration: number;
  playing: boolean;
  rate: PlaybackRate;
  /** True when a real audio file backs this playback (false = simulated clock for mock data). */
  isReal: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  skip: (deltaSeconds: number) => void;
  setRate: (rate: PlaybackRate) => void;
  cycleRate: () => void;
};

let audioModeConfigured = false;
function ensureAudioMode() {
  if (audioModeConfigured) return;
  audioModeConfigured = true;
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {
    audioModeConfigured = false;
  });
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * expo-audio releases the native player when the owning component unmounts, which can happen before
 * focus-cleanup callbacks run; calling into a released player throws, and there is nothing left to control.
 */
function safely(fn: () => unknown) {
  try {
    const r = fn();
    if (r instanceof Promise) r.catch(() => {});
  } catch {
    // Player already released.
  }
}

/**
 * One playback engine for the archive list and the detail screen.
 *
 * - Recordings with a `uri` play through expo-audio (`useAudioPlayer` + `useAudioPlayerStatus`).
 * - Mock recordings (`uri: null`) run a simulated clock that respects the playback rate,
 *   so the whole UI (waveform progress, transcript highlighting, seeking) behaves identically.
 */
export function usePlayback(
  recording: Recording | null | undefined,
  options?: { initialPosition?: number },
): Playback {
  const uri = recording?.uri ?? null;
  const isReal = !!uri;
  const id = recording?.id ?? null;
  const initialPosition = options?.initialPosition ?? 0;

  // Declared before useAudioPlayer so its cleanup runs first: unmount-time pause() calls (e.g. from
  // useFocusEffect) must not reach a player expo-audio has already released.
  const unmounted = useRef(false);
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  const player = useAudioPlayer(uri, { updateInterval: STATUS_INTERVAL_MS });
  const status = useAudioPlayerStatus(player);

  const [rate, setRateState] = useState<PlaybackRate>(1);
  const [sim, setSim] = useState({ position: initialPosition, playing: false });
  // Optimistic position while an async seek on the real player is in flight (avoids the playhead snapping back).
  const [pendingSeek, setPendingSeek] = useState<number | null>(null);

  // Reset when the underlying recording changes (state adjustment during render, no effect needed).
  const [trackedId, setTrackedId] = useState(id);
  if (trackedId !== id) {
    setTrackedId(id);
    setSim({ position: 0, playing: false });
    setPendingSeek(null);
  }

  const duration = isReal
    ? status.duration > 0
      ? status.duration
      : (recording?.duration ?? 0)
    : (recording?.duration ?? 0);

  const rawPosition = isReal ? (pendingSeek ?? status.currentTime) : sim.position;
  const position = clamp(rawPosition || 0, 0, duration);
  const playing = isReal ? status.playing : sim.playing;

  // Simulated clock for mock data.
  useEffect(() => {
    if (isReal || !sim.playing) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const delta = ((now - last) / 1000) * rate;
      last = now;
      setSim((prev) => {
        if (!prev.playing) return prev;
        const next = prev.position + delta;
        if (next >= duration) return { position: duration, playing: false };
        return { position: next, playing: true };
      });
    }, SIM_TICK_MS);
    return () => clearInterval(timer);
  }, [isReal, sim.playing, rate, duration]);

  // Keep the real player's rate in sync (the player is recreated when the source changes).
  useEffect(() => {
    if (isReal) safely(() => player.setPlaybackRate(rate));
  }, [isReal, player, rate]);

  // Resume from a handed-over position (e.g. list → detail) once the real file is loaded.
  const appliedInitialSeek = useRef(false);
  useEffect(() => {
    if (!isReal || appliedInitialSeek.current || !status.isLoaded) return;
    appliedInitialSeek.current = true;
    if (initialPosition > 0) safely(() => player.seekTo(initialPosition));
  }, [isReal, status.isLoaded, initialPosition, player]);

  const seek = useCallback(
    (seconds: number) => {
      const t = clamp(seconds, 0, duration);
      if (isReal) {
        setPendingSeek(t);
        Promise.resolve()
          .then(() => player.seekTo(t))
          .catch(() => {})
          .finally(() => setPendingSeek(null));
      } else {
        setSim((prev) => ({ ...prev, position: t }));
      }
    },
    [duration, isReal, player],
  );

  const play = useCallback(() => {
    if (isReal) {
      ensureAudioMode();
      if (status.currentTime >= duration - 0.1) safely(() => player.seekTo(0));
      safely(() => player.play());
    } else {
      setSim((prev) => ({ position: prev.position >= duration - 0.05 ? 0 : prev.position, playing: true }));
    }
  }, [duration, isReal, player, status.currentTime]);

  const pause = useCallback(() => {
    if (isReal) {
      if (!unmounted.current) safely(() => player.pause());
    }
    else setSim((prev) => (prev.playing ? { ...prev, playing: false } : prev));
  }, [isReal, player]);

  const toggle = useCallback(() => (playing ? pause() : play()), [pause, play, playing]);

  const skip = useCallback((delta: number) => seek(position + delta), [position, seek]);

  const setRate = useCallback((r: PlaybackRate) => setRateState(r), []);

  const cycleRate = useCallback(
    () => setRateState((r) => PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(r) + 1) % PLAYBACK_RATES.length]),
    [],
  );

  return { position, duration, playing, rate, isReal, play, pause, toggle, seek, skip, setRate, cycleRate };
}
