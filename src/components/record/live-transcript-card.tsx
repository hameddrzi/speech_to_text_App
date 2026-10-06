import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

type Props = {
  /** Live speech-to-text output so far. Empty string → placeholder. */
  text: string;
  /** Replaces the default placeholder, e.g. when no speech model is downloaded yet. */
  hint?: string;
  /** True while audio is being captured (shows "Listening…"). */
  active: boolean;
  /** Fixed body height so the layout never jumps as text streams in. */
  height?: number;
};

/**
 * Frosted card where live speech-to-text will stream.
 * The STT core only needs to feed `text` (and `active`); the card handles scrolling and empty states.
 */
export function LiveTranscriptCard({ text, active, hint, height = 64 }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const hasText = text.trim().length > 0;

  return (
    <Glass radius={Radius.lg} intensity={45} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="text" size={14} color={active ? Colors.record : Colors.labelSecondary} />
          <Text style={styles.title}>Live transcript</Text>
        </View>
        {active ? (
          <View style={styles.listening}>
            <Text style={styles.listeningText}>Listening</Text>
            <Dots />
          </View>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ height }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {hasText ? (
          <Text
            style={styles.body}
            accessibilityLiveRegion="polite">
            {text}
          </Text>
        ) : (
          <Text style={styles.placeholder}>
            {active
              ? (hint ?? 'Listening… your words will appear here in a moment.')
              : (hint ?? 'Your words will appear here live while you record.')}
          </Text>
        )}
      </ScrollView>
    </Glass>
  );
}

function Dots() {
  return (
    <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Dot delay={0} />
      <Dot delay={160} />
      <Dot delay={320} />
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const v = useSharedValue(0);

  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 420, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 420, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [delay, v]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + v.value * 0.75,
    transform: [{ translateY: -v.value * 2 }],
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  title: {
    ...Type.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  listening: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  listeningText: {
    ...Type.caption,
    color: Colors.record,
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
    paddingTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.record,
  },
  body: {
    ...Type.callout,
    lineHeight: 22,
  },
  placeholder: {
    ...Type.footnote,
    lineHeight: 18,
    color: Colors.labelTertiary,
  },
});
