import { Alert, Platform, Share } from 'react-native';

import { transcriptText, type Recording } from '@/data/recordings';

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

/** Share title + transcript text via the system sheet. */
export async function shareRecording(r: Recording): Promise<void> {
  const text = transcriptText(r);
  try {
    // TODO: share the audio file itself (expo-sharing) once recordings have a real uri.
    await Share.share({ title: r.title, message: text ? `${r.title}\n\n${text}` : r.title });
  } catch {
    // Dismissed or unsupported on this platform — nothing to do.
  }
}
