import {
  RecordingPresets,
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import type { BackgroundCapture, BackgroundSupport } from '@/hooks/background-capture';

export type { BackgroundCapture, BackgroundSupport };

/**
 * A tiny AMR recorder whose only job is to hold expo-audio's microphone foreground service. It uses the
 * same audio source as the PCM stream (so both share one input) and is paused right after it starts.
 */
const KEEPER_OPTIONS: RecordingOptions = {
  ...RecordingPresets.LOW_QUALITY,
  sampleRate: 8000,
  numberOfChannels: 1,
  bitRate: 12200,
  android: { ...RecordingPresets.LOW_QUALITY.android, audioSource: 'voice_recognition' },
};

/** Android 10 (API 29) is the first version that lets one app capture from two recorders at once. */
const MIN_API = 29;
/** POST_NOTIFICATIONS is a runtime permission from Android 13 (API 33). */
const NOTIFICATION_API = 33;

/** Stops the keeper (which leaves the foreground service), deletes its file and resets the audio mode. */
async function releaseKeeper(recorder: AudioRecorder, uri: string | null): Promise<void> {
  // Playback elsewhere may have reset the audio mode; the recorder only leaves the foreground
  // service when the mode still allows background recording.
  await setAudioModeAsync({ allowsBackgroundRecording: true, playsInSilentMode: true }).catch(() => {});
  try {
    await recorder.stop();
  } catch {}
  if (uri) {
    try {
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch {}
  }
  await setAudioModeAsync({ allowsBackgroundRecording: false, playsInSilentMode: true }).catch(() => {});
}

/**
 * Keeps the microphone alive while the screen is off or the app is in the background (Android).
 *
 * Android silences the microphone of an app in the background unless it runs a foreground service of
 * type "microphone". The PCM stream (`@fugood/react-native-audio-pcm-stream`) has none, and expo-audio's
 * `useAudioStream` has none either; only expo-audio's `AudioRecorder` starts one (the
 * `AudioRecordingService` that the plugin's `enableBackgroundRecording` adds, with its "Recording audio"
 * notification). So while a take is active, a paused expo-audio recorder holds that service, and the
 * PCM stream in the same process keeps capturing under it.
 *
 * Tapping "Stop" in the notification stops the service; `onStoppedBySystem` is then called so the take
 * can be saved.
 */
export function useBackgroundCapture(onStoppedBySystem: () => void): BackgroundCapture {
  const activeRef = useRef(false);
  const uriRef = useRef<string | null>(null);
  const onStoppedRef = useRef(onStoppedBySystem);
  useEffect(() => {
    onStoppedRef.current = onStoppedBySystem;
  });

  const takeUri = () => {
    const uri = uriRef.current;
    uriRef.current = null;
    return uri;
  };

  const recorderRef = useRef<AudioRecorder | null>(null);
  // A finished event while active means the service went away under us: "Stop" in the notification
  // (or a media-server error). Either way background capture is over, so the take is wrapped up.
  const recorder = useAudioRecorder(KEEPER_OPTIONS, (status) => {
    if (status.isFinished && activeRef.current && recorderRef.current) {
      activeRef.current = false;
      void releaseKeeper(recorderRef.current, takeUri());
      onStoppedRef.current();
    }
  });
  useEffect(() => {
    recorderRef.current = recorder;
  }, [recorder]);

  const begin = async (): Promise<BackgroundSupport> => {
    if (activeRef.current) return 'active';
    const api = typeof Platform.Version === 'number' ? Platform.Version : 0;
    if (api < MIN_API) return 'unavailable';
    if (api >= NOTIFICATION_API) {
      const perm = await requestNotificationPermissionsAsync().catch(() => null);
      // expo-audio refuses to start its service without the notification permission.
      if (!perm?.granted) return 'needs-notifications';
    }
    try {
      await setAudioModeAsync({ allowsBackgroundRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      uriRef.current = recorder.uri;
      recorder.record();
      activeRef.current = true;
    } catch (e) {
      console.warn('[background-capture] could not start the recording service', e);
      await releaseKeeper(recorder, takeUri());
      return 'unavailable';
    }
    try {
      recorder.pause();
    } catch {
      // Still recording a few bytes per second of AMR into the cache; deleted in end().
    }
    return 'active';
  };

  const end = async (): Promise<void> => {
    if (!activeRef.current) return;
    activeRef.current = false;
    await releaseKeeper(recorder, takeUri());
  };

  return { begin, end };
}
