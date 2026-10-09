import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Duration, Easings, PressScale, Spring, Timing, useMotion } from '@/constants/motion';
import { Colors, Shadow } from '@/constants/theme';

type Props = {
  /** true → red rounded square (stop); false → red circle (record). */
  recording: boolean;
  /** Soft red halo pulse — only while audio is actually being captured. */
  live?: boolean;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  accessibilityLabel: string;
  testID?: string;
};

/** Stop-square side as a fraction of the circle, and its visual corner radius. */
const STOP_SCALE = 0.46;
const STOP_RADIUS = 8;
const HALO_PERIOD = 1600;

/**
 * The Voice Memos record button: white ring around a red circle that morphs into a rounded square.
 * The morph is a scale + corner-radius change on a fixed-size view, so it never triggers layout.
 */
export function RecordButton({
  recording,
  live = false,
  onPress,
  disabled,
  size = 78,
  accessibilityLabel,
  testID,
}: Props) {
  const inner = size - 18;
  const morph = useSharedValue(recording ? 1 : 0);
  const pressed = useSharedValue(1);
  const halo = useSharedValue(0);
  // The pulsing halo is decoration; with reduced motion the button only morphs.
  const { reduced } = useMotion();
  const pulse = live && !reduced;

  useEffect(() => {
    morph.set(withSpring(recording ? 1 : 0, Spring.morph));
  }, [recording, morph]);

  useEffect(() => {
    if (pulse) {
      halo.set(0);
      halo.set(withRepeat(withTiming(1, { duration: HALO_PERIOD, easing: Easings.out }), -1, false));
    } else {
      cancelAnimation(halo);
      halo.set(withTiming(0, { duration: Duration.exit }));
    }
  }, [pulse, halo]);

  const innerStyle = useAnimatedStyle(() => {
    const m = morph.get();
    const scale = interpolate(m, [0, 1], [1, STOP_SCALE]);
    // Interpolate the radius as it is seen on screen, then undo the scale so the corners stay round.
    const visibleRadius = interpolate(m, [0, 1], [inner / 2, STOP_RADIUS]);
    return {
      borderRadius: visibleRadius / scale,
      transform: [{ scale }],
    };
  });

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressed.get() }] }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: pulse ? interpolate(halo.get(), [0, 1], [0.55, 0]) : 0,
    transform: [{ scale: interpolate(halo.get(), [0, 1], [1, 1.45]) }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, { width: size, height: size, borderRadius: size / 2 }, haloStyle]}
      />
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        hitSlop={8}
        onPress={onPress}
        onPressIn={() => {
          pressed.set(withTiming(PressScale.control + 0.02, Timing.pressIn));
        }}
        onPressOut={() => {
          pressed.set(withSpring(1, Spring.press));
        }}>
        <Animated.View
          style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }, scaleStyle]}>
          <View style={[styles.ringStroke, { borderRadius: size / 2 }]} />
          <Animated.View style={[styles.inner, { width: inner, height: inner }, innerStyle]} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    backgroundColor: Colors.recordSoft,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.25)',
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    ...Shadow.soft,
    shadowOpacity: 0.12,
  },
  ringStroke: {
    ...StyleSheet.absoluteFill,
    margin: 3,
    borderWidth: 3,
    borderColor: 'rgba(60,60,67,0.14)',
  },
  inner: {
    backgroundColor: Colors.record,
  },
});
