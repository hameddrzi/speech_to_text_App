import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';

import { haptic } from '@/utils/haptics';
import { SKIP_SECONDS, type PlaybackRate } from '@/components/archive/use-playback';
import { Glass } from '@/components/glass';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';

/** Circular arrow with "15" inside, like SF Symbols gobackward.15 / goforward.15. */
export function SkipButton({
  direction,
  onPress,
  size = 30,
}: {
  direction: 'back' | 'forward';
  onPress: () => void;
  size?: number;
}) {
  const back = direction === 'back';
  return (
    <Pressable
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

/** Play/pause. `large` is a filled dark disc (detail screen); default is a bare glyph (inline row). */
export function PlayButton({
  playing,
  onPress,
  large = false,
}: {
  playing: boolean;
  onPress: () => void;
  large?: boolean;
}) {
  const size = large ? 72 : 48;
  const iconSize = large ? 32 : 34;
  const color = large ? '#FFFFFF' : Colors.label;
  return (
    <Pressable
      onPress={() => {
        haptic.medium();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause' : 'Play'}
      style={({ pressed }) => [
        styles.play,
        { width: size, height: size, borderRadius: size / 2, transform: [{ scale: pressed ? 0.94 : 1 }] },
        large && styles.playLarge,
      ]}>
      <Animated.View
        key={playing ? 'pause' : 'play'}
        entering={ZoomIn.duration(160)}
        exiting={ZoomOut.duration(120)}
        style={styles.playIcon}>
        <Ionicons
          name={playing ? 'pause' : 'play'}
          size={iconSize}
          color={color}
          style={!playing ? { marginLeft: iconSize * 0.1 } : undefined}
        />
      </Animated.View>
    </Pressable>
  );
}

/** Glass pill cycling 1× → 1.5× → 2×. */
export function SpeedPill({ rate, onPress }: { rate: PlaybackRate; onPress: () => void }) {
  return (
    <Pressable
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  iconSize?: number;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}>
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
