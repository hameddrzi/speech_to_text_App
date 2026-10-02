import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { Colors, Radius } from '@/constants/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
  size?: number;
};

/** Round frosted-glass secondary control (pause / resume / discard) that fades out when unavailable. */
export function ControlButton({ icon, accessibilityLabel, onPress, disabled, color = Colors.label, size = 52 }: Props) {
  const visible = useSharedValue(disabled ? 0 : 1);
  const pressed = useSharedValue(1);

  useEffect(() => {
    visible.value = withTiming(disabled ? 0 : 1, { duration: 220 });
  }, [disabled, visible]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.28 + visible.value * 0.72,
    transform: [{ scale: pressed.value * (0.9 + visible.value * 0.1) }],
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
        pressed.set(withSpring(0.9, { damping: 20, stiffness: 400 }));
      }}
      onPressOut={() => {
        pressed.set(withSpring(1, { damping: 14, stiffness: 300 }));
      }}>
      <Animated.View style={style}>
        <Glass
          radius={Radius.pill}
          intensity={50}
          strong
          style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={size * 0.44} color={color} />
        </Glass>
      </Animated.View>
    </Pressable>
  );
}
