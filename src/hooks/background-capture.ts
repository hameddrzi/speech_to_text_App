import { setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

/**
 * - `active`: recording continues with the screen off / app in the background.
 * - `needs-notifications`: Android 13+ without the notification permission (the foreground service can't start).
 * - `unavailable`: not supported here (Android 9 and older, web) or the service failed to start.
 */
export type BackgroundSupport = 'active' | 'needs-notifications' | 'unavailable';

export type BackgroundCapture = {
  /** Call right before the microphone starts. Never throws. */
  begin: () => Promise<BackgroundSupport>;
  /** Call after the microphone stopped. Never throws. */
  end: () => Promise<void>;
};

/**
 * iOS (and the web stub). On iOS, the expo-audio config plugin adds the `audio` background mode, and the
 * PCM stream's AudioQueue keeps recording in the background as long as the audio session allows recording
 * and isn't deactivated when the app leaves the foreground, which is what this audio mode asks for.
 * Android: see background-capture.android.ts.
 */
export function useBackgroundCapture(_onStoppedBySystem: () => void): BackgroundCapture {
  const begin = async (): Promise<BackgroundSupport> => {
    if (Platform.OS !== 'ios') return 'unavailable';
    try {
      await setAudioModeAsync({ allowsRecording: true, allowsBackgroundRecording: true, playsInSilentMode: true });
      return 'active';
    } catch {
      return 'unavailable';
    }
  };

  const end = async (): Promise<void> => {
    if (Platform.OS !== 'ios') return;
    await setAudioModeAsync({
      allowsRecording: false,
      allowsBackgroundRecording: false,
      playsInSilentMode: true,
    }).catch(() => {});
  };

  return { begin, end };
}
