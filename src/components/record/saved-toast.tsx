import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOutUp, SlideInUp } from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { Colors, Radius, Shadow, Spacing, Type } from '@/constants/theme';

type Props = {
  title: string;
  onView: () => void;
  onDismiss: () => void;
  /** Auto-dismiss delay. */
  duration?: number;
  top: number;
};

/** Floating glass confirmation shown after a take is saved, with a "View" shortcut to the archive. */
export function SavedToast({ title, onView, onDismiss, duration = 4000, top }: Props) {
  useEffect(() => {
    const id = setTimeout(onDismiss, duration);
    return () => clearTimeout(id);
  }, [onDismiss, duration]);

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(18).stiffness(180)}
      exiting={FadeOutUp.duration(220)}
      style={[styles.wrap, { top }]}
      pointerEvents="box-none">
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
