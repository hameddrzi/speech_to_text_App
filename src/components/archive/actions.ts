import { Alert, Platform, Share } from 'react-native';

import type { Recording } from '@/data/recordings';
import { haptic } from '@/utils/haptics';
import { formatTranscriptForSharing } from '@/utils/transcript-text';

/** Cross-platform destructive confirmation; resolves to whether the user confirmed. */
export function confirmDelete(title: string): Promise<boolean> {
  const message = 'This recording and its transcript will be permanently removed.';
  if (Platform.OS === 'web') {
    const confirmFn = (globalThis as { confirm?: (m: string) => boolean }).confirm;
    return Promise.resolve(confirmFn ? confirmFn(`Delete “${title}”?\n${message}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(
      `Delete “${title}”?`,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * Shares the recording as plain text (title, date · duration, transcript) via the system sheet.
 * Works for every transcript state — without a transcript it shares a short note instead.
 */
export async function shareRecording(r: Recording): Promise<void> {
  haptic.light();
  const message = formatTranscriptForSharing(r);
  try {
    // Only `message`: on Android it becomes EXTRA_TEXT. `content.title` would become EXTRA_SUBJECT,
    // which apps like Telegram prepend to the text (title twice). No `url` either — on iOS some
    // apps drop the text when both are present.
    // TODO: share the audio file itself (expo-sharing) once recordings have a real uri.
    await Share.share({ message }, { dialogTitle: r.title, subject: r.title });
  } catch {
    // Dismissed or unsupported on this platform — nothing to do.
  }
}
