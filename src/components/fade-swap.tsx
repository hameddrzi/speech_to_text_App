import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { Duration, fadeIn } from '@/constants/motion';

type Props = {
  /** Changing this remounts the content, which then fades in. */
  swapKey: string;
  children: ReactNode;
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Soft in-place swap for state changes (status chips, "Copied", model state). The new content fades in;
 * the old one leaves immediately, so two versions never overlap or double-fade.
 * Nothing animates on the first mount, so lists and screens appear calmly.
 */
export function FadeSwap({ swapKey, children, duration = Duration.fast, style }: Props) {
  return (
    <LayoutAnimationConfig skipEntering>
      <Animated.View key={swapKey} entering={fadeIn(duration)} style={style}>
        {children}
      </Animated.View>
    </LayoutAnimationConfig>
  );
}
