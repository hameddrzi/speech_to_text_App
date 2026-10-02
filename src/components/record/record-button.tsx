import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

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
};

const MORPH_SPRING = { damping: 15, stiffness: 170, mass: 0.9 };

/** The Voice Memos record button: white ring around a red circle that springs into a rounded square. */
export function RecordButton({ recording, live = false, onPress, disabled, size = 78, accessibilityLabel }: Props) {
  const inner = size - 18;
  const morph = useSharedValue(recording ? 1 : 0);
  const pressed = useSharedValue(1);
  const halo = useSharedValue(0);

  useEffect(() => {
    morph.value = withSpring(recording ? 1 : 0, MORPH_SPRING);
  }, [recording, morph]);

  useEffect(() => {
    if (live) {
      halo.value = 0;
      halo.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
    } else {
      cancelAnimation(halo);
      halo.value = withTiming(0, { duration: 200 });
    }
  }, [live, halo]);

  const innerStyle = useAnimatedStyle(() => {
    const side = interpolate(morph.value, [0, 1], [inner, inner * 0.46]);
    return {
      width: side,
      height: side,
      borderRadius: interpolate(morph.value, [0, 1], [inner / 2, 8]),
    };
  });

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressed.value }] }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: live ? interpolate(halo.value, [0, 1], [0.55, 0]) : 0,
    transform: [{ scale: interpolate(halo.value, [0, 1], [1, 1.45]) }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, { width: size, height: size, borderRadius: size / 2 }, haloStyle]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        hitSlop={8}
        onPress={onPress}
        onPressIn={() => {
          pressed.set(withSpring(0.92, { damping: 20, stiffness: 400 }));
        }}
        onPressOut={() => {
          pressed.set(withSpring(1, { damping: 14, stiffness: 300 }));
        }}>
        <Animated.View
          style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }, scaleStyle]}>
          <View style={[styles.ringStroke, { borderRadius: size / 2 }]} />
          <Animated.View style={[styles.inner, innerStyle]} />
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
