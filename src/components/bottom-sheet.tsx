import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Timing, useMotion } from '@/constants/motion';
import { Spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Label of the backdrop for screen readers. */
  closeLabel?: string;
  children: ReactNode;
};

// Timing curves, never springs: ease-out in, ease-in out. They also run with reduced motion, where the
// sheet only fades (no slide).
const OPEN = { ...Timing.enter, reduceMotion: Timing.fade.reduceMotion };
const CLOSE = { ...Timing.exit, reduceMotion: Timing.fade.reduceMotion };
/** How far below its resting place the sheet starts, as a fraction of the window height. */
const SLIDE_FRACTION = 0.6;

/**
 * Bottom sheet over a dimmed backdrop. One calm, interruptible slide (no springs, no layout animations):
 * the Modal itself doesn't animate, and the sheet slides out before the Modal is unmounted.
 */
export function BottomSheet({ visible, onClose, closeLabel = 'Close', children }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);
  const { reduced } = useMotion();
  const slide = reduced ? 0 : height * SLIDE_FRACTION;

  // Mount before sliding in (state adjustment during render, no extra effect pass).
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      progress.set(withTiming(1, OPEN));
    } else {
      progress.set(
        withTiming(0, CLOSE, (finished) => {
          if (finished) runOnJS(setMounted)(false);
        }),
      );
    }
  }, [visible, mounted, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: reduced ? progress.get() : 1,
    transform: [{ translateY: (1 - progress.get()) * slide }],
  }));

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
          />
        </Animated.View>
        <Animated.View style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }, sheetStyle]}>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(15,23,42,0.22)',
  },
  sheetWrap: {
    paddingHorizontal: Spacing.sm,
  },
});
