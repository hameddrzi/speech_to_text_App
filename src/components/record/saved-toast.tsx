import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { Timing, Travel, useMotion } from '@/constants/motion';
import { TestIDs } from '@/constants/test-ids';
import { Colors, Radius, Shadow, Spacing, Type } from '@/constants/theme';

type Props = {
  title: string;
  onView: () => void;
  onDismiss: () => void;
  /** Auto-dismiss delay. */
  duration?: number;
  top: number;
};

// Opacity-led timing curves (ease-out in, ease-in out); they keep running as a plain fade with reduced motion.
const SHOW = { ...Timing.enter, reduceMotion: Timing.fade.reduceMotion };
const HIDE = { ...Timing.exit, reduceMotion: Timing.fade.reduceMotion };

/**
 * Floating glass confirmation shown after a take is saved, with a "View" shortcut to the archive.
 * It fades in with a short slide from just above its spot, and fades out the same way before unmounting.
 */
export function SavedToast({ title, onView, onDismiss, duration = 3000, top }: Props) {
  const shown = useSharedValue(0);
  const lift = useMotion().distance(Travel.toast);

  useEffect(() => {
    shown.set(withTiming(1, SHOW));
  }, [shown]);

  const hide = (then: () => void) => {
    shown.set(
      withTiming(0, HIDE, (finished) => {
        if (finished) runOnJS(then)();
      }),
    );
  };

  useEffect(() => {
    const id = setTimeout(() => hide(onDismiss), duration);
    return () => clearTimeout(id);
    // hide() only touches the shared value; re-arming the timer on every render would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDismiss, duration]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (1 - shown.get()) * -lift }],
  }));

  return (
    <Animated.View testID={TestIDs.record.savedToast} style={[styles.wrap, { top }, style]} pointerEvents="box-none">
      <Glass radius={Radius.xl} intensity={70} strong style={styles.toast} accessibilityLiveRegion="polite">
        <View style={styles.check}>
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        </View>
        <View style={styles.texts}>
          <Text style={styles.headline}>Saved to Archive</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Pressable
          testID={TestIDs.record.savedToastView}
          accessibilityRole="button"
          accessibilityLabel="View in Archive"
          hitSlop={8}
          onPress={onView}
          style={({ pressed }) => [styles.view, pressed && { opacity: 0.6 }]}>
          <Text style={styles.viewText}>View</Text>
        </Pressable>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    alignItems: 'center',
    zIndex: 10,
  },
  toast: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    ...Shadow.lifted,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: 1,
  },
  headline: {
    ...Type.headline,
    fontSize: 15,
  },
  sub: {
    ...Type.footnote,
  },
  view: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.tintSoft,
  },
  viewText: {
    ...Type.subhead,
    fontWeight: '600',
    color: Colors.tint,
  },
});
