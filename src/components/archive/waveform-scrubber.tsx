import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptic } from '@/utils/haptics';
import { Duration, Easings, Spring, Timing } from '@/constants/motion';
import { Colors } from '@/constants/theme';

type Props = {
  waveform: number[];
  /** 0–1 played fraction. */
  progress: number;
  playing: boolean;
  height?: number;
  barWidth?: number;
  gap?: number;
  /** Large playhead with knobs (detail screen) vs thin line (inline row). */
  variant?: 'compact' | 'large';
  onScrubStart?: () => void;
  /** Called continuously while dragging, with the fraction under the finger. */
  onScrub?: (fraction: number) => void;
  /** Called when the user releases or taps — commit the seek here. */
  onSeek: (fraction: number) => void;
  accessibilityLabel?: string;
  accessibilityValueText?: string;
  style?: StyleProp<ViewStyle>;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** Playback ticks arrive about this often; progress glides linearly between them. */
const TICK_GLIDE_MS = 120;
/** Knob growth while the finger is on the scrubber. */
const KNOB_ACTIVE_SCALE = 1.5;

/** Linear resample of the stored amplitudes to exactly `count` bars so the waveform fits any width. */
function resample(values: number[], count: number): number[] {
  if (values.length === 0 || count <= 0) return [];
  if (values.length === 1) return Array.from({ length: count }, () => values[0]);
  return Array.from({ length: count }, (_, i) => {
    const pos = (i * (values.length - 1)) / Math.max(1, count - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(values.length - 1, lo + 1);
    const t = pos - lo;
    return values[lo] * (1 - t) + values[hi] * t;
  });
}

function Bars({
  bars,
  height,
  barWidth,
  gap,
  color,
}: {
  bars: number[];
  height: number;
  barWidth: number;
  gap: number;
  color: string;
}) {
  return (
    <View style={[styles.bars, { height, gap }]}>
      {bars.map((v, i) => (
        <View
          key={i}
          style={{
            width: barWidth,
            height: Math.max(barWidth, v * height),
            borderRadius: barWidth / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Voice Memos style waveform: idle bars, a "played" copy revealed by an animated mask, and a draggable playhead.
 * Drag horizontally to scrub, tap to jump. Progress animates linearly between playback ticks so motion stays fluid.
 */
export const WaveformScrubber = memo(function WaveformScrubber({
  waveform,
  progress,
  playing,
  height = 44,
  barWidth = 2.5,
  gap = 2,
  variant = 'compact',
  onScrubStart,
  onScrub,
  onSeek,
  accessibilityLabel = 'Playback position',
  accessibilityValueText,
  style,
}: Props) {
  const [width, setWidth] = useState(0);
  const shown = useSharedValue(clamp01(progress));
  const scrubbing = useSharedValue(false);
  const large = variant === 'large';

  const count = width > 0 ? Math.max(8, Math.floor((width + gap) / (barWidth + gap))) : 0;
  const bars = useMemo(() => resample(waveform, count), [waveform, count]);

  useEffect(() => {
    if (scrubbing.get()) return;
    const target = clamp01(progress);
    shown.set(
      playing
        ? withTiming(target, { duration: TICK_GLIDE_MS, easing: Easings.linear })
        : withTiming(target, { ...Timing.fast, duration: Duration.exit }),
    );
  }, [progress, playing, scrubbing, shown]);

  const gesture = useMemo(() => {
    const toFraction = (x: number) => (width > 0 ? clamp01(x / width) : 0);
    const pan = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onStart((e) => {
        scrubbing.set(true);
        shown.set(toFraction(e.x));
        haptic.selection();
        onScrubStart?.();
      })
      .onUpdate((e) => {
        const f = toFraction(e.x);
        shown.set(f);
        onScrub?.(f);
      })
      .onEnd((e) => {
        onSeek(toFraction(e.x));
      })
      .onFinalize(() => {
        scrubbing.set(false);
      });
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e) => {
        haptic.light();
        onSeek(toFraction(e.x));
      });
    return Gesture.Exclusive(pan, tap);
  }, [width, onScrubStart, onScrub, onSeek, scrubbing, shown]);

  // The "played" copy is revealed by a clip that slides right while its content slides back left by the
  // same amount: two opposite translations instead of an animated width, so playback never re-lays out.
  const clipStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (shown.get() - 1) * width }] }));
  const clipContentStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - shown.get()) * width }] }));
  const headStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shown.get() * width - (large ? 1 : 0.75) }],
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scrubbing.get() ? KNOB_ACTIVE_SCALE : 1, Spring.control) }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const verticalPad = large ? 10 : 6;

  return (
    <GestureDetector gesture={gesture}>
      <View
        onLayout={onLayout}
        style={[{ height: height + verticalPad * 2, justifyContent: 'center' }, style]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={accessibilityValueText ? { text: accessibilityValueText } : undefined}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const step = 0.05;
          if (e.nativeEvent.actionName === 'increment') onSeek(clamp01(progress + step));
          if (e.nativeEvent.actionName === 'decrement') onSeek(clamp01(progress - step));
        }}>
        {width > 0 && (
          <>
            <Bars bars={bars} height={height} barWidth={barWidth} gap={gap} color={Colors.waveIdle} />
            <Animated.View style={[styles.played, { top: verticalPad, width }, clipStyle]} pointerEvents="none">
              <Animated.View style={[{ width }, clipContentStyle]}>
                <Bars bars={bars} height={height} barWidth={barWidth} gap={gap} color={Colors.wavePlayed} />
              </Animated.View>
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[styles.head, { width: large ? 2 : 1.5 }, headStyle]}>
              {large && <Animated.View style={[styles.knob, styles.knobTop, knobStyle]} />}
              {large && <Animated.View style={[styles.knob, styles.knobBottom, knobStyle]} />}
            </Animated.View>
          </>
        )}
      </View>
    </GestureDetector>
  );
});

const KNOB = 9;

const styles = StyleSheet.create({
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  played: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
  },
  head: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 1,
    backgroundColor: Colors.tint,
    alignItems: 'center',
  },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: Colors.tint,
  },
  knobTop: { top: -KNOB / 2 },
  knobBottom: { bottom: -KNOB / 2 },
});
