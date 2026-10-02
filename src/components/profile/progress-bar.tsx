import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Colors } from '@/constants/theme';

type Segment = { value: number; color: string };

type Props = {
  /** Either a single 0–1 progress… */
  progress?: number;
  color?: string;
  /** …or stacked fractions (0–1 each) like the iPhone Storage bar. */
  segments?: Segment[];
  height?: number;
  style?: StyleProp<ViewStyle>;
};

function Fill({ value, color }: Segment) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.set(withTiming(Math.max(0, Math.min(1, value)), { duration: 420 }));
  }, [value, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return <Animated.View style={[styles.fill, { backgroundColor: color }, style]} />;
}

/** Glassy rounded track with animated fill(s). */
export function ProgressBar({ progress = 0, color = Colors.tint, segments, height = 6, style }: Props) {
  const parts = segments ?? [{ value: progress, color }];
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }, style]}>
      {parts.map((s, i) => (
        <Fill key={i} value={s.value} color={s.color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: 'rgba(118,118,128,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.9)',
    gap: 2,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});
