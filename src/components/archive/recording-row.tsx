import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Extrapolation,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { haptic } from '@/components/archive/haptics';
import { StatusChip } from '@/components/archive/status-chip';
import { Glass } from '@/components/glass';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { transcriptText, type Recording } from '@/data/recordings';
import { formatDuration, formatRecordingDate, isRTL } from '@/utils/format';

export const ROW_LAYOUT = LinearTransition.springify().damping(22).stiffness(220).mass(0.9);

export type RecordingRowProps = {
  recording: Recording;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  /** Must ask for confirmation; resolves true when the recording was deleted. */
  onDelete: (recording: Recording) => Promise<boolean>;
  onRetry: (id: string) => void;
  /** Lets the list keep only one swipeable open at a time. */
  onSwipeOpen: (methods: SwipeableMethods) => void;
};

const ACTION_SIZE = 52;

function SwipeAction({
  progress,
  index,
  icon,
  color,
  label,
  onPress,
}: {
  progress: SharedValue<number>;
  index: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => {
    // Staggered reveal: the outer action pops in slightly after the inner one.
    const p = interpolate(progress.get(), [0.15 + index * 0.15, 0.85 + index * 0.1], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ scale: 0.6 + 0.4 * p }] };
  });
  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.action, { backgroundColor: color, opacity: pressed ? 0.75 : 1 }]}>
        <Ionicons name={icon} size={22} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

/**
 * Voice Memos style row: title / date / duration / transcript preview.
 * Tap opens the recording page (full transcript + player); swipe left reveals favorite + delete.
 */
export const RecordingRow = memo(function RecordingRow({
  recording,
  onOpen,
  onToggleFavorite,
  onDelete,
  onRetry,
  onSwipeOpen,
}: RecordingRowProps) {
  const swipeRef = useRef<SwipeableMethods>(null);
  const titleRTL = isRTL(recording.title);
  const preview = transcriptText(recording);
  const previewRTL = isRTL(preview);
  const id = recording.id;

  const handleDelete = async () => {
    haptic.warning();
    const deleted = await onDelete(recording);
    if (!deleted) swipeRef.current?.close();
  };

  const handleFavorite = () => {
    haptic.selection();
    onToggleFavorite(id);
    swipeRef.current?.close();
  };

  const statusLine =
    recording.transcriptStatus === 'processing'
      ? `Transcribing… ${Math.round((recording.transcriptProgress ?? 0) * 100)}%`
      : recording.transcriptStatus === 'failed'
        ? 'Transcription failed — tap Retry'
        : recording.transcriptStatus === 'none'
          ? 'No transcript'
          : null;

  return (
    <Animated.View layout={ROW_LAYOUT} exiting={FadeOut.duration(180)} style={styles.outer}>
      <ReanimatedSwipeable
        ref={swipeRef}
        friction={1.8}
        rightThreshold={36}
        overshootRight={false}
        containerStyle={styles.swipeContainer}
        onSwipeableWillOpen={() => {
          haptic.light();
          if (swipeRef.current) onSwipeOpen(swipeRef.current);
        }}
        renderRightActions={(progress) => (
          <View style={styles.actionsRow}>
            <SwipeAction
              progress={progress}
              index={0}
              icon={recording.favorite ? 'star' : 'star-outline'}
              color={Colors.warning}
              label={recording.favorite ? 'Remove from favorites' : 'Add to favorites'}
              onPress={handleFavorite}
            />
            <SwipeAction
              progress={progress}
              index={1}
              icon="trash"
              color={Colors.record}
              label="Delete"
              onPress={handleDelete}
            />
          </View>
        )}>
        <Glass strong elevated={false} radius={Radius.lg} style={styles.card}>
          <Pressable
            onPress={() => {
              haptic.selection();
              onOpen(id);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${recording.title}, ${formatRecordingDate(recording.createdAt)}, ${formatDuration(recording.duration)}`}
            accessibilityHint="Opens the transcript and player"
            style={({ pressed }) => pressed && styles.pressed}>
            <View style={styles.titleRow}>
              <Text
                numberOfLines={1}
                style={[
                  styles.title,
                  { textAlign: titleRTL ? 'right' : 'left', writingDirection: titleRTL ? 'rtl' : 'ltr' },
                ]}>
                {recording.title}
              </Text>
              {recording.favorite && <Ionicons name="star" size={13} color={Colors.warning} />}
              <Ionicons name="chevron-forward" size={16} color={Colors.labelTertiary} />
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.date}>{formatRecordingDate(recording.createdAt)}</Text>
              <StatusChip status={recording.transcriptStatus} onRetry={() => onRetry(id)} />
              <View style={styles.flex} />
              <Text style={styles.duration}>{formatDuration(recording.duration)}</Text>
            </View>
            {preview.length > 0 ? (
              <Text
                numberOfLines={2}
                style={[
                  styles.preview,
                  { textAlign: previewRTL ? 'right' : 'left', writingDirection: previewRTL ? 'rtl' : 'ltr' },
                ]}>
                {preview}
              </Text>
            ) : (
              statusLine && <Text style={styles.previewMuted}>{statusLine}</Text>
            )}
          </Pressable>
        </Glass>
      </ReanimatedSwipeable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  outer: {
    marginBottom: Spacing.sm + 2,
  },
  swipeContainer: {
    borderRadius: Radius.lg,
  },
  card: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md + 2,
    paddingBottom: Spacing.md + 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  title: {
    ...Type.headline,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xxs + 1,
  },
  flex: { flex: 1 },
  date: {
    ...Type.subhead,
  },
  duration: {
    ...Type.subhead,
    fontVariant: ['tabular-nums'],
  },
  preview: {
    ...Type.footnote,
    color: 'rgba(60,60,67,0.75)',
    lineHeight: 18,
    marginTop: Spacing.sm - 1,
  },
  pressed: {
    opacity: 0.6,
  },
  previewMuted: {
    ...Type.footnote,
    color: Colors.labelTertiary,
    marginTop: Spacing.sm - 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
  },
  action: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: ACTION_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
