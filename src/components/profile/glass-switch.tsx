import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Spring, Timing } from '@/constants/motion';
import { Colors } from '@/constants/theme';

const TRACK_W = 51;
const TRACK_H = 31;
const KNOB = 27;
const PAD = 2;
const STRETCH = 7;

const TRACK_OFF = 'rgba(120,120,128,0.16)';

type Props = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
};

/**
 * iOS-style switch drawn in JS so it looks identical on iOS, Android and web:
 * white knob with soft shadow, green track when on, knob stretches while pressed like UIKit.
 */
export function GlassSwitch({ value, onValueChange, accessibilityLabel, disabled, testID }: Props) {
  const progress = useSharedValue(value ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    progress.set(withSpring(value ? 1 : 0, Spring.control));
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [0, 1], [TRACK_OFF, Colors.success]),
  }));

  // Only transforms are animated (no width), so the switch never triggers a layout pass while it moves.
  const knobStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.get()));
    const stretch = pressed.get() * STRETCH;
    const travel = TRACK_W - PAD * 2 - KNOB;
    // Stretch from the left edge when off and from the right edge when on, like UIKit.
    const x = p * travel + (stretch / 2) * (1 - 2 * p);
    return { transform: [{ translateX: x }, { scaleX: (KNOB + stretch) / KNOB }] };
  });

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPressIn={() => {
        pressed.set(withTiming(1, Timing.fast));
      }}
      onPressOut={() => {
        pressed.set(withTiming(0, Timing.change));
      }}
      onPress={() => onValueChange(!value)}
      style={disabled && styles.disabled}>
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: PAD,
    justifyContent: 'center',
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  disabled: { opacity: 0.4 },
});
