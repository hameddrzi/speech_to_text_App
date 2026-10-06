import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Mirrors the Profile → Haptics switch; SettingsProvider keeps it in sync. */
let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

function run(fn: () => Promise<unknown>, force = false) {
  if (Platform.OS === 'web' || (!enabled && !force)) return;
  fn().catch(() => {});
}

/** App-wide haptics. Respects the Haptics setting and no-ops on web. */
export const haptic = {
  selection: (force = false) => run(() => Haptics.selectionAsync(), force),
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
