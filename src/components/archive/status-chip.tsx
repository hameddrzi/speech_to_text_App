import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Shimmer } from '@/components/archive/shimmer';
import { FadeSwap } from '@/components/fade-swap';
import { Duration } from '@/constants/motion';
import { TestIDs } from '@/constants/test-ids';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { TranscriptStatus } from '@/data/recordings';

type Props = {
  status: TranscriptStatus;
  /** A 'processing' recording that can't start because no speech model is downloaded. */
  waitingForModel?: boolean;
  onRetry?: () => void;
};

/**
 * Tiny transcript-state chip: done ✓, processing (shimmering), waiting for a model, failed (tap to retry).
 * Renders nothing for 'none'. When the state changes (e.g. Transcribing → Transcript) the new chip fades in.
 */
export function StatusChip({ status, waitingForModel, onRetry }: Props) {
  if (status === 'none') return null;
  const kind = status === 'processing' && waitingForModel ? 'waiting' : status;
  return (
    <FadeSwap swapKey={kind} duration={Duration.base}>
      <ChipContent status={status} waitingForModel={waitingForModel} onRetry={onRetry} />
    </FadeSwap>
  );
}

function ChipContent({ status, waitingForModel, onRetry }: Props) {
  if (status === 'done') {
    return (
      <View
        testID={TestIDs.archive.chipDone}
        style={[styles.chip, { backgroundColor: Colors.successSoft }]}
        accessibilityLabel="Transcribed">
        <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
        <Text style={[styles.text, { color: Colors.successText }]}>Transcript</Text>
      </View>
    );
  }

  if (status === 'processing' && waitingForModel) {
    return (
      <View
        testID={TestIDs.archive.chipWaiting}
        style={[styles.chip, { backgroundColor: Colors.warningSoft }]}
        accessibilityLabel="Waiting for a speech model">
        <Ionicons name="hourglass-outline" size={11} color="#B86E00" />
        <Text style={[styles.text, { color: Colors.warningText }]}>Waiting</Text>
      </View>
    );
  }

  if (status === 'processing') {
    return (
      <View
        testID={TestIDs.archive.chipProcessing}
        style={[styles.chip, { backgroundColor: Colors.tintSoft }]}
        accessibilityLabel="Transcribing">
        <Shimmer style={StyleSheet.absoluteFill} base="transparent" highlight="rgba(255,255,255,0.9)" />
        <Ionicons name="sparkles" size={11} color={Colors.tint} />
        <Text style={[styles.text, { color: Colors.tint }]}>Transcribing</Text>
      </View>
    );
  }

  return (
    <Pressable
      testID={TestIDs.archive.chipRetry}
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
