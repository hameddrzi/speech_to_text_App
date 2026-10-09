import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { FadeSwap } from '@/components/fade-swap';
import { Glass } from '@/components/glass';
import { Duration, Easings, fadeIn, fadeOut, useMotion } from '@/constants/motion';
import { TestIDs } from '@/constants/test-ids';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

type Props = {
  /** Live speech-to-text output so far. Empty string → placeholder. */
  text: string;
  /** Replaces the default placeholder, e.g. when no speech model is downloaded yet. */
  hint?: string;
  /** True while audio is being captured (shows "Listening…"). */
  active: boolean;
  /** Short screens: the body starts at two lines instead of three. */
  compact?: boolean;
};

/** Line height of the streaming text, at 100 % system text size. */
const BODY_LINE_HEIGHT = 22;
/** The body never shrinks below this many lines (so short hints don't make the card jump)… */
const MIN_LINES = { compact: 2, regular: 3 } as const;
/** …and grows with its content up to this many, then scrolls. */
const MAX_LINES = 4;

/**
 * Index where `next` stops matching `prev`, moved back to the start of that word. Whisper's rolling
 * preview rewrites the last few words as it hears more, so the "new" part starts at the first change.
 */
function freshStart(prev: string, next: string): number {
  const n = Math.min(prev.length, next.length);
  let i = 0;
  while (i < n && prev[i] === next[i]) i++;
  if (i === next.length) return i;
  while (i > 0 && !/\s/.test(next[i - 1])) i--;
  return i;
}

/**
 * Newly arrived words fade in while the rest of the text stays put. The text is drawn twice with identical
 * layout: the base layer shows the settled words (new ones transparent), and an overlay layer shows only
 * the new words and fades in. Only a View's opacity animates, so line wrapping can never jump.
 */
function StreamingText({ text }: { text: string }) {
  const [shown, setShown] = useState({ text, split: text.length, version: 0 });
  // Adjust state during render when new text arrives (no extra effect pass, no one-frame flash).
  if (text !== shown.text) {
    setShown({ text, split: freshStart(shown.text, text), version: shown.version + 1 });
  }
  const settled = shown.text.slice(0, shown.split);
  const fresh = shown.text.slice(shown.split);

  return (
    <View>
      <Text style={styles.body} accessibilityLiveRegion="polite">
        {settled}
        <Text style={styles.transparent}>{fresh}</Text>
      </Text>
      {fresh.length > 0 ? (
        <Animated.View
          key={shown.version}
          entering={fadeIn(Duration.slow)}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Text style={styles.body}>
            <Text style={styles.transparent}>{settled}</Text>
            {fresh}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Frosted card where live speech-to-text will stream.
 * The STT core only needs to feed `text` (and `active`); the card handles scrolling and empty states.
 */
export function LiveTranscriptCard({ text, active, hint, compact = false }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const hasText = text.trim().length > 0;
  // The body sizes to its content between a min and a max, measured in lines of the *scaled* text, so a
  // hint or a few words always fit at any system text size. Past the max it scrolls.
  const { fontScale } = useWindowDimensions();
  const line = BODY_LINE_HEIGHT * fontScale;
  const minHeight = Math.ceil(line * (compact ? MIN_LINES.compact : MIN_LINES.regular));
  const maxHeight = Math.ceil(line * MAX_LINES);
  const placeholder = active
    ? (hint ?? 'Listening… your words will appear here in a moment.')
    : (hint ?? 'Your words will appear here live while you record.');

  return (
    <Glass testID={TestIDs.record.liveTranscript} radius={Radius.lg} intensity={45} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="text" size={14} color={active ? Colors.record : Colors.labelSecondary} />
          <Text style={styles.title}>Live transcript</Text>
        </View>
        {active ? (
          <Animated.View entering={fadeIn(Duration.base)} exiting={fadeOut()} style={styles.listening}>
            <Text style={styles.listeningText}>Listening</Text>
            <Dots />
          </Animated.View>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        style={[styles.scroll, { minHeight, maxHeight }]}
        showsVerticalScrollIndicator={false}
        // Follow live text as it grows; a static hint stays at the top.
        onContentSizeChange={() => {
          if (hasText) scrollRef.current?.scrollToEnd({ animated: true });
        }}>
        {hasText ? (
          <StreamingText text={text} />
        ) : (
          <FadeSwap swapKey={placeholder} duration={Duration.base}>
            <Text style={styles.placeholder}>{placeholder}</Text>
          </FadeSwap>
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

const DOT_HALF_PERIOD = 420;

function Dot({ delay }: { delay: number }) {
  const v = useSharedValue(0);
  // With reduced motion the dots stay still (and fully visible).
  const { reduced } = useMotion();

  useEffect(() => {
    if (reduced) {
      v.set(1);
      return;
    }
    const half = { duration: DOT_HALF_PERIOD, easing: Easings.breathe };
    v.set(withDelay(delay, withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1)));
    return () => cancelAnimation(v);
  }, [delay, v, reduced]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + v.get() * 0.75,
    transform: [{ translateY: -v.get() * 2 }],
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
  scroll: {
    flexGrow: 0,
  },
  body: {
    ...Type.callout,
    lineHeight: BODY_LINE_HEIGHT,
  },
  transparent: {
    color: 'transparent',
  },
  placeholder: {
    ...Type.footnote,
    lineHeight: 18,
    color: Colors.labelTertiary,
  },
});
