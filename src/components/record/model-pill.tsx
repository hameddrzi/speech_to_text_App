import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Glass } from '@/components/glass';
import { TestIDs } from '@/constants/test-ids';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useSettings } from '@/store/settings';
import { STT_SUPPORTED } from '@/stt/model-files';
import { modelInfo } from '@/stt/models';
import { useModelDownload } from '@/stt/use-model-download';
import { haptic } from '@/utils/haptics';

/**
 * Small glass pill on the Record header showing whether speech-to-text is ready:
 * the active model, download progress, or a nudge to get one. Tapping it opens Profile.
 */
export function ModelPill({ disabled }: { disabled?: boolean }) {
  const { settings } = useSettings();
  const download = useModelDownload();
  if (!STT_SUPPORTED) return null;

  const model = settings.speechModel;
  const label = modelInfo(model).label;
  const ready = download.downloaded.includes(model);
  const downloading = download.downloading === model;

  const icon: keyof typeof Ionicons.glyphMap = ready ? 'sparkles' : downloading ? 'cloud-download' : 'alert-circle';
  const color = ready ? Colors.tint : downloading ? Colors.tint : Colors.warningText;
  const text = ready ? label : downloading ? `${Math.round(download.progress * 100)}%` : 'Get Model';
  const a11y = ready
    ? `Speech model ${label} is ready. Opens Profile.`
    : downloading
      ? `Downloading the ${label} speech model. Opens Profile.`
      : 'No speech model downloaded. Opens Profile to download one.';

  return (
    <Pressable
      testID={TestIDs.record.modelPill}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={8}
      onPress={() => {
        haptic.selection();
        router.navigate('/profile');
      }}
      style={({ pressed }) => [{ opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}>
      <Glass radius={Radius.pill} intensity={50} strong elevated={false} style={styles.pill}>
        <Ionicons name={icon} size={13} color={color} />
        <Text style={[styles.text, { color }]}>{text}</Text>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    height: 32,
    paddingHorizontal: Spacing.md,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
