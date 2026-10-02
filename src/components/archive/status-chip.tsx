import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Shimmer } from '@/components/archive/shimmer';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { TranscriptStatus } from '@/data/recordings';

type Props = {
  status: TranscriptStatus;
  onRetry?: () => void;
};

/** Tiny transcript-state chip: done ✓, processing (shimmering), failed (tap to retry). Renders nothing for 'none'. */
export function StatusChip({ status, onRetry }: Props) {
  if (status === 'none') return null;

  if (status === 'done') {
    return (
      <View style={[styles.chip, { backgroundColor: 'rgba(52,199,89,0.12)' }]} accessibilityLabel="Transcribed">
        <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
        <Text style={[styles.text, { color: '#1F8A3B' }]}>Text</Text>
      </View>
    );
  }

  if (status === 'processing') {
    return (
      <View style={[styles.chip, { backgroundColor: Colors.tintSoft }]} accessibilityLabel="Transcribing">
        <Shimmer style={StyleSheet.absoluteFill} base="transparent" highlight="rgba(255,255,255,0.9)" />
        <Ionicons name="sparkles" size={11} color={Colors.tint} />
        <Text style={[styles.text, { color: Colors.tint }]}>Transcribing</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onRetry}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Transcription failed. Retry"
      style={({ pressed }) => [styles.chip, { backgroundColor: Colors.recordSoft, opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name="refresh" size={11} color={Colors.record} />
      <Text style={[styles.text, { color: Colors.record }]}>Retry</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 20,
    paddingHorizontal: Spacing.sm - 1,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.06,
  },
});
