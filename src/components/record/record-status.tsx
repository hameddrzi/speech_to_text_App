import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { FadeSwap } from '@/components/fade-swap';
import { Duration, Easings, useMotion } from '@/constants/motion';
import { TestIDs } from '@/constants/test-ids';
import { Colors, Spacing, Type } from '@/constants/theme';
import type { RecordPhase } from '@/hooks/record-session';

type Props = {
  phase: RecordPhase;
  /** Overrides the label (e.g. an error message). */
  message?: string | null;
  simulated?: boolean;
};

const BLINK_MS = 700;

/**
 * Tiny status line under the timer: blinking red dot while recording, calm text otherwise.
 * Each new state fades in over the old one, so "Starting… → Recording → Paused" reads as one line changing.
 */
export function RecordStatus({ phase, message, simulated }: Props) {
  const blink = useSharedValue(1);
  const recording = phase === 'recording';
  // A blinking dot is motion; with reduced motion it stays solid.
  const { reduced } = useMotion();
  const blinking = recording && !reduced;

  useEffect(() => {
    if (blinking) {
      blink.set(withRepeat(withTiming(0.2, { duration: BLINK_MS, easing: Easings.breathe }), -1, true));
    } else {
      cancelAnimation(blink);
      blink.set(withTiming(1, { duration: Duration.fast }));
    }
  }, [blinking, blink]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: blink.get() }));

  let label = 'Ready to record';
  if (phase === 'starting') label = 'Starting…';
  if (phase === 'recording') label = simulated ? 'Recording · demo meter' : 'Recording';
  if (phase === 'paused') label = 'Paused';
  if (phase === 'saving') label = 'Saving…';
  if (message) label = message;

  const showDot = phase === 'recording' || phase === 'paused';

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <FadeSwap swapKey={label} duration={Duration.base} style={styles.row}>
        {showDot ? (
          <Animated.View
            style={[styles.dot, { backgroundColor: recording ? Colors.record : Colors.labelTertiary }, dotStyle]}
          />
        ) : null}
        <Text
          testID={TestIDs.record.status}
          style={[styles.label, message ? { color: Colors.record } : null, recording && { color: Colors.record }]}
          numberOfLines={1}>
          {label}
        </Text>
      </FadeSwap>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 20,
    justifyContent: 'center',
  },
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
