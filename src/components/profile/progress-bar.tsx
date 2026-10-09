import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Timing } from '@/constants/motion';
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

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * A single progress fill (downloads). It spans the whole track and is scaled from the left edge, so frequent
 * progress updates only change a transform — no layout pass per frame.
 */
function ScaleFill({ value, color }: Segment) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(clamp01(value), Timing.progress));
  }, [value, p]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: p.get() }] }));
  return <Animated.View style={[styles.fill, styles.scaleFill, { backgroundColor: color }, style]} />;
}

/**
 * One segment of a stacked bar (Storage). Segments sit side by side, so they animate their width; this bar
 * only changes when storage does, never per frame.
 */
function WidthFill({ value, color }: Segment) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.set(withTiming(clamp01(value), Timing.progress));
  }, [value, w]);
  // toFixed keeps tiny values out of exponent notation ("1e-7%"), which Android can't parse.
  const style = useAnimatedStyle(() => ({ width: `${(w.get() * 100).toFixed(3)}%` as `${number}%` }));
  return <Animated.View style={[styles.fill, { backgroundColor: color }, style]} />;
}

/** Glassy rounded track with animated fill(s). */
export function ProgressBar({ progress = 0, color = Colors.tint, segments, height = 6, style }: Props) {
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }, style]}>
      {segments ? (
        segments.map((s, i) => <WidthFill key={i} value={s.value} color={s.color} />)
      ) : (
        <ScaleFill value={progress} color={color} />
      )}
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
  scaleFill: {
    width: '100%',
    transformOrigin: 'left',
  },
});
