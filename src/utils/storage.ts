import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Tiny JSON persistence: a file in the app's document directory on native, localStorage on web.
 * Reads never throw — a missing or corrupt file just yields `null`.
 */
export function readJSON<T>(name: string): T | null {
  try {
    const raw =
      Platform.OS === 'web'
        ? globalThis.localStorage?.getItem(name)
        : (() => {
            const f = new File(Paths.document, `${name}.json`);
            return f.exists ? f.textSync() : null;
          })();
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJSON(name: string, value: unknown): void {
  try {
    const raw = JSON.stringify(value);
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(name, raw);
      return;
    }
    const f = new File(Paths.document, `${name}.json`);
    if (!f.exists) f.create();
    f.write(raw);
  } catch {
    // Best effort: losing a write is better than crashing the UI.
  }
}
