import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Spacing, Type } from '@/constants/theme';
import type { RecordPhase } from '@/hooks/record-session';

type Props = {
  phase: RecordPhase;
  /** Overrides the label (e.g. an error message). */
  message?: string | null;
  simulated?: boolean;
};

/** Tiny status line under the timer: blinking red dot while recording, calm text otherwise. */
export function RecordStatus({ phase, message, simulated }: Props) {
  const blink = useSharedValue(1);
  const recording = phase === 'recording';

  useEffect(() => {
    if (recording) {
      blink.value = withRepeat(withTiming(0.2, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      cancelAnimation(blink);
      blink.value = withTiming(1, { duration: 150 });
    }
  }, [recording, blink]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  let label = 'Ready to record';
  if (phase === 'starting') label = 'Starting…';
  if (phase === 'recording') label = simulated ? 'Recording · demo meter' : 'Recording';
  if (phase === 'paused') label = 'Paused';
  if (phase === 'saving') label = 'Saving…';
  if (message) label = message;

  const showDot = phase === 'recording' || phase === 'paused';

  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      {showDot ? (
        <Animated.View
          style={[styles.dot, { backgroundColor: recording ? Colors.record : Colors.labelTertiary }, dotStyle]}
        />
      ) : null}
      <Text
        style={[styles.label, message ? { color: Colors.record } : null, recording && { color: Colors.record }]}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
    minHeight: 20,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  label: {
    ...Type.footnote,
    fontWeight: '500',
  },
});
