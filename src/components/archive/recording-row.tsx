import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { haptic } from '@/utils/haptics';
import { shareRecording } from '@/components/archive/actions';
import { introProgress } from '@/components/archive/list-intro';
import { StatusChip } from '@/components/archive/status-chip';
import { Glass } from '@/components/glass';
import { fadeOut, listLayout, PressScale, Spring, Timing, Travel, useMotion } from '@/constants/motion';
import { recordingRow, TestIDs } from '@/constants/test-ids';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { transcriptText, type Recording } from '@/data/recordings';
import { useSelectedModelReady } from '@/stt/use-model-download';
import { formatDuration, formatRecordingDate } from '@/utils/format';

export const ROW_LAYOUT = listLayout;

export type RecordingRowProps = {
  recording: Recording;
  /** First-mount stagger clock and this row's position in the list (see list-intro.tsx). */
  introClock?: SharedValue<number>;
  introIndex?: number;
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
  testID,
}: {
  progress: SharedValue<number>;
  index: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const style = useAnimatedStyle(() => {
    // Staggered reveal: each outer action pops in slightly after the inner one; the last one
    // (index 2) still finishes exactly at full open.
    const p = interpolate(progress.get(), [0.1 + index * 0.15, 0.7 + index * 0.15], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ scale: 0.6 + 0.4 * p }] };
  });
  return (
    <Animated.View style={style}>
      <Pressable
        testID={testID}
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
 * Tap opens the recording page (full transcript + player); swipe left reveals favorite, share and delete.
 */
export const RecordingRow = memo(function RecordingRow({
  recording,
  introClock,
  introIndex,
  onOpen,
  onToggleFavorite,
  onDelete,
  onRetry,
  onSwipeOpen,
}: RecordingRowProps) {
  const swipeRef = useRef<SwipeableMethods>(null);
  const preview = transcriptText(recording);
  const modelReady = useSelectedModelReady();
  const waitingForModel = recording.transcriptStatus === 'processing' && !modelReady;
  const id = recording.id;

  // First-mount stagger + press feedback (the card sinks slightly), as transform + opacity only. The swipe
  // pan cancels the press as soon as it activates, so a swipe never leaves the card pressed.
  const pressed = useSharedValue(0);
  const travel = useMotion().distance(Travel.row);
  const pressStyle = useAnimatedStyle(() => {
    const intro = introProgress(introClock, introIndex);
    return {
      opacity: intro * (1 - pressed.get() * 0.12),
      transform: [{ translateY: (1 - intro) * travel }, { scale: 1 - pressed.get() * (1 - PressScale.row) }],
    };
  });

  const handleDelete = async () => {
    haptic.warning();
    const deleted = await onDelete(recording);
    if (!deleted) swipeRef.current?.close();
  };

  const handleShare = () => {
    swipeRef.current?.close();
    void shareRecording(recording);
  };

  const handleFavorite = () => {
    haptic.selection();
    onToggleFavorite(id);
    swipeRef.current?.close();
  };

  const statusLine = waitingForModel
    ? 'Waiting for a speech model. Download one in Profile.'
    : recording.transcriptStatus === 'processing'
      ? recording.transcriptProgress === undefined
        ? 'Queued for transcription'
        : `Transcribing… ${Math.round(recording.transcriptProgress * 100)}%`
      : recording.transcriptStatus === 'failed'
        ? (recording.transcriptError ?? 'Transcription failed. Tap Retry.')
        : recording.transcriptStatus === 'none'
          ? 'No transcript'
          : recording.transcriptStatus === 'done'
            ? 'No speech detected'
            : null;

  return (
    <Animated.View layout={ROW_LAYOUT} exiting={fadeOut()} style={styles.outer}>
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
              testID={TestIDs.archive.rowFavorite}
            />
            <SwipeAction
              progress={progress}
              index={1}
              icon="share-outline"
              color={Colors.tint}
              label="Share"
              onPress={handleShare}
              testID={TestIDs.archive.rowShare}
            />
            <SwipeAction
              progress={progress}
              index={2}
              icon="trash"
              color={Colors.record}
              label="Delete"
              onPress={handleDelete}
              testID={TestIDs.archive.rowDelete}
            />
          </View>
        )}>
        <Animated.View style={pressStyle}>
          <Glass strong elevated={false} radius={Radius.lg} style={styles.card}>
            <Pressable
              testID={recordingRow(id)}
              onPress={() => {
                haptic.selection();
                onOpen(id);
              }}
              onPressIn={() => {
                pressed.set(withTiming(1, Timing.pressIn));
              }}
              onPressOut={() => {
                pressed.set(withSpring(0, Spring.press));
              }}
              accessibilityRole="button"
              accessibilityLabel={`${recording.title}, ${formatRecordingDate(recording.createdAt)}, ${formatDuration(recording.duration)}`}
              accessibilityHint="Opens the transcript and player">
              <View style={styles.titleRow}>
                <Text
                  numberOfLines={1}
                  style={styles.title}>
                  {recording.title}
                </Text>
                {recording.favorite && <Ionicons name="star" size={13} color={Colors.warning} />}
                <Ionicons name="chevron-forward" size={16} color={Colors.labelTertiary} />
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.date}>{formatRecordingDate(recording.createdAt)}</Text>
                <StatusChip
                  status={recording.transcriptStatus}
                  waitingForModel={waitingForModel}
                  onRetry={() => onRetry(id)}
                />
                <View style={styles.flex} />
                <Text style={styles.duration}>{formatDuration(recording.duration)}</Text>
              </View>
              {preview.length > 0 ? (
                <Text
                  numberOfLines={2}
                  style={styles.preview}>
                  {preview}
                </Text>
              ) : (
                statusLine && (
                  <Text style={styles.previewMuted} numberOfLines={2}>
                    {statusLine}
                  </Text>
                )
              )}
            </Pressable>
          </Glass>
        </Animated.View>
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
