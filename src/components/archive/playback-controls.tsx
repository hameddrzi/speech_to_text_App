import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptic } from '@/utils/haptics';
import { SKIP_SECONDS, type PlaybackRate } from '@/components/archive/use-playback';
import { Glass } from '@/components/glass';
import { PressScale, Spring, Timing, useMotion } from '@/constants/motion';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';

/** Circular arrow with "15" inside, like SF Symbols gobackward.15 / goforward.15. */
export function SkipButton({
  direction,
  onPress,
  size = 30,
  testID,
}: {
  direction: 'back' | 'forward';
  onPress: () => void;
  size?: number;
  testID?: string;
}) {
  const back = direction === 'back';
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={back ? `Back ${SKIP_SECONDS} seconds` : `Forward ${SKIP_SECONDS} seconds`}
      style={({ pressed }) => [styles.skip, { width: size + 14, height: size + 14, opacity: pressed ? 0.45 : 1 }]}>
      <Ionicons
        name="reload"
        size={size}
        color={Colors.label}
        style={back ? { transform: [{ scaleX: -1 }] } : undefined}
      />
      <Text style={[styles.skipText, { fontSize: size * 0.3 }]}>{SKIP_SECONDS}</Text>
    </Pressable>
  );
}

/** How small the outgoing glyph gets while it fades during the play ↔ pause morph. */
const GLYPH_MIN_SCALE = 0.6;

/**
 * Play/pause. `large` is a filled dark disc (detail screen); default is a bare glyph (inline row).
 * Both glyphs stay mounted and cross-fade with a slight scale, so the swap is one continuous morph
 * (no mount/unmount, no overlapping layout animations). The disc sinks a little while pressed.
 */
export function PlayButton({
  playing,
  onPress,
  large = false,
  size: sizeProp,
  disabled = false,
  testID,
}: {
  playing: boolean;
  onPress: () => void;
  large?: boolean;
  disabled?: boolean;
  /** Disc diameter for `large` (default 72), e.g. smaller in the compact landscape dock. */
  size?: number;
  testID?: string;
}) {
  const size = sizeProp ?? (large ? 72 : 48);
  const iconSize = large ? Math.round(size * 0.44) : 34;
  const color = large ? '#FFFFFF' : Colors.label;
  const p = useSharedValue(playing ? 1 : 0);
  const pressed = useSharedValue(1);
  const { reduced } = useMotion();
  const minScale = reduced ? 1 : GLYPH_MIN_SCALE;

  useEffect(() => {
    p.set(withTiming(playing ? 1 : 0, Timing.fadeFast));
  }, [playing, p]);

  const discStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressed.get() }] }));
  const playStyle = useAnimatedStyle(() => ({
    opacity: 1 - p.get(),
    transform: [{ scale: 1 - p.get() * (1 - minScale) }],
  }));
  const pauseStyle = useAnimatedStyle(() => ({
    opacity: p.get(),
    transform: [{ scale: minScale + p.get() * (1 - minScale) }],
  }));

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        haptic.medium();
        onPress();
      }}
      onPressIn={() => {
        pressed.set(withTiming(PressScale.button, Timing.pressIn));
      }}
      onPressOut={() => {
        pressed.set(withSpring(1, Spring.press));
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={playing ? 'Pause' : 'Play'}>
      <Animated.View
        style={[
          styles.play,
          { width: size, height: size, borderRadius: size / 2 },
          large && styles.playLarge,
          disabled && styles.playDisabled,
          discStyle,
        ]}>
        <Animated.View style={[styles.playIcon, playStyle]} pointerEvents="none">
          <Ionicons name="play" size={iconSize} color={color} style={{ marginLeft: iconSize * 0.1 }} />
        </Animated.View>
        <Animated.View style={[styles.playIcon, pauseStyle]} pointerEvents="none">
          <Ionicons name="pause" size={iconSize} color={color} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/** Glass pill cycling 1× → 1.5× → 2×. */
export function SpeedPill({ rate, onPress, testID }: { rate: PlaybackRate; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Playback speed ${rate}x. Double tap to change`}>
      {({ pressed }) => (
        <Glass radius={Radius.pill} elevated={false} style={[styles.speed, pressed && { opacity: 0.6 }]}>
          <Text style={[styles.speedText, rate !== 1 && { color: Colors.tint }]}>{rate}×</Text>
        </Glass>
      )}
    </Pressable>
  );
}

/** Round glass icon button used in action strips and headers. */
export function GlassIconButton({
  icon,
  onPress,
  label,
  color = Colors.label,
  size = 40,
  iconSize = 19,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  iconSize?: number;
  testID?: string;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}>
      {({ pressed }) => (
        <Glass
          radius={size / 2}
          elevated={false}
          style={[styles.iconButton, { width: size, height: size }, pressed && { opacity: 0.55 }]}>
          <Ionicons name={icon} size={iconSize} color={color} />
        </Glass>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  skip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    position: 'absolute',
    fontWeight: '700',
    color: Colors.label,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  play: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playLarge: {
    backgroundColor: Colors.label,
    ...Shadow.soft,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  playDisabled: {
    opacity: 0.3,
  },
  playIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speed: {
    minWidth: 52,
    height: 32,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.label,
    fontVariant: ['tabular-nums'],
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
