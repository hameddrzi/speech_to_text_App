import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { FadeSwap } from '@/components/fade-swap';
import { Glass } from '@/components/glass';
import { PressScale, Spring, Timing } from '@/constants/motion';
import { Colors, Radius } from '@/constants/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
  size?: number;
};

/**
 * Round frosted-glass secondary control (pause / resume / discard). It rests dimmed and slightly smaller
 * while unavailable, and eases up to full size when recording starts.
 */
export function ControlButton({ icon, accessibilityLabel, onPress, disabled, color = Colors.label, size = 52 }: Props) {
  const visible = useSharedValue(disabled ? 0 : 1);
  const pressed = useSharedValue(1);

  useEffect(() => {
    visible.set(withTiming(disabled ? 0 : 1, disabled ? Timing.exit : Timing.enter));
  }, [disabled, visible]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.28 + visible.get() * 0.72,
    transform: [{ scale: pressed.get() * (0.9 + visible.get() * 0.1) }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={onPress}
      onPressIn={() => {
        pressed.set(withTiming(PressScale.control, Timing.pressIn));
      }}
      onPressOut={() => {
        pressed.set(withSpring(1, Spring.press));
      }}>
      <Animated.View style={style}>
        <Glass
          radius={Radius.pill}
          intensity={50}
          strong
          style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          {/* Pause ↔ resume glyphs cross-fade instead of snapping. */}
          <FadeSwap swapKey={icon}>
            <Ionicons name={icon} size={size * 0.44} color={color} />
          </FadeSwap>
        </Glass>
      </Animated.View>
    </Pressable>
  );
}
