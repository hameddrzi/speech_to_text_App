import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { memo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { haptic } from '@/utils/haptics';
import { Shimmer } from '@/components/archive/shimmer';
import { FadeSwap } from '@/components/fade-swap';
import { Duration, fadeIn, Timing } from '@/constants/motion';
import { TestIDs, transcriptSegment } from '@/constants/test-ids';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { transcriptText, type Recording, type TranscriptSegment } from '@/data/recordings';
import { useSelectedModelReady } from '@/stt/use-model-download';
import { formatDuration } from '@/utils/format';

type Props = {
  recording: Recording;
  position: number;
  onSeek: (seconds: number) => void;
  onRetry: () => void;
  /** Stops a running or queued transcription; shown as Cancel while transcribing. */
  onCancel?: () => void;
  /** Called with the active segment's y offset inside the card whenever the highlighted segment changes. */
  onActiveSegmentChange?: (y: number) => void;
};

export function activeSegmentIndex(segments: TranscriptSegment[], position: number): number {
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const last = i === segments.length - 1;
    if (position >= s.start && (position < s.end || (last && position <= s.end))) return i;
  }
  return -1;
}

const SEGMENT_TEXT = 'rgba(60,60,67,0.78)';
const HIGHLIGHT_OFF = 'rgba(10,132,255,0)';
const HIGHLIGHT_ON = 'rgba(10,132,255,0.09)';

const Segment = memo(function Segment({
  segment,
  active,
  onPress,
  onLayoutY,
  testID,
}: {
  testID: string;
  segment: TranscriptSegment;
  active: boolean;
  onPress: (start: number) => void;
  onLayoutY: (y: number) => void;
}) {
  const a = useSharedValue(active ? 1 : 0);

  // The highlight, timestamp and text color all move together as playback reaches a segment.
  useEffect(() => {
    a.set(withTiming(active ? 1 : 0, Timing.fade));
  }, [active, a]);

  const bg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(a.get(), [0, 1], [HIGHLIGHT_OFF, HIGHLIGHT_ON]),
  }));
  const stampColor = useAnimatedStyle(() => ({
    color: interpolateColor(a.get(), [0, 1], [Colors.labelTertiary, Colors.tint]),
  }));
  const textColor = useAnimatedStyle(() => ({
    color: interpolateColor(a.get(), [0, 1], [SEGMENT_TEXT, Colors.label]),
  }));

  return (
    <Pressable
      testID={testID}
      onPress={() => onPress(segment.start)}
      onLayout={(e) => onLayoutY(e.nativeEvent.layout.y)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${formatDuration(segment.start)}. ${segment.text}`}
      accessibilityHint="Plays from this point">
      <Animated.View style={[styles.segment, bg]}>
        <Animated.Text style={[styles.stamp, stampColor]}>{formatDuration(segment.start)}</Animated.Text>
        <Animated.Text style={[styles.segmentText, textColor]}>{segment.text}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
});

function SkeletonLines() {
  const widths = ['100%', '94%', '98%', '86%', '62%'] as const;
  return (
    <View style={styles.skeleton}>
      {widths.map((w, i) => (
        <Shimmer key={i} style={[styles.skeletonLine, { width: w }]} />
      ))}
    </View>
  );
}

function Notice({
  icon,
  tint,
  title,
  body,
  action,
  actionIcon = 'refresh',
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  title: string;
  body: string;
  action: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction: () => void;
}) {
  return (
    <Animated.View entering={fadeIn(Duration.base)} style={styles.notice}>
      <View style={[styles.noticeIcon, { backgroundColor: `${tint}1F` }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeBody}>{body}</Text>
      <Pressable
        testID={TestIDs.detail.noticeAction}
        onPress={() => {
          haptic.light();
          onAction();
        }}
        accessibilityRole="button"
        accessibilityLabel={action}
        style={({ pressed }) => [styles.noticeButton, pressed && { opacity: 0.7 }]}>
        <Ionicons name={actionIcon} size={15} color="#FFFFFF" />
        <Text style={styles.noticeButtonText}>{action}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Full-page, time-coded transcript for the recording screen; follows playback and seeks on tap. */
export function TranscriptCard({ recording, position, onSeek, onRetry, onCancel, onActiveSegmentChange }: Props) {
  const { transcript, transcriptStatus } = recording;
  const modelReady = useSelectedModelReady();
  const waitingForModel = transcriptStatus === 'processing' && !modelReady;
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentY = useRef<number[]>([]);
  const listY = useRef(0);

  const active = activeSegmentIndex(transcript, position);

  useEffect(() => {
    if (active < 0) return;
    const y = segmentY.current[active];
    if (y !== undefined) onActiveSegmentChange?.(listY.current + y);
  }, [active, onActiveSegmentChange]);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const copy = async () => {
    await Clipboard.setStringAsync(transcriptText(recording));
    haptic.success();
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1600);
  };

  const done = transcriptStatus === 'done' && transcript.length > 0;

  // Opening a recording shows its state at once; only later changes (e.g. Transcribing → transcript) fade in.
  return (
    <LayoutAnimationConfig skipEntering>
      <View style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.heading} accessibilityRole="header">
            Transcript
          </Text>
          <View style={styles.flex} />
          {done && (
            <Pressable
              testID={TestIDs.detail.copyText}
              onPress={copy}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={copied ? 'Copied' : 'Copy text'}
              style={({ pressed }) => [styles.copy, pressed && { opacity: 0.6 }]}>
              <FadeSwap swapKey={copied ? 'copied' : 'copy'} style={styles.copyInner}>
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={15}
                  color={copied ? Colors.success : Colors.tint}
                />
                <Text style={[styles.copyText, copied && { color: Colors.success }]}>
                  {copied ? 'Copied' : 'Copy text'}
                </Text>
              </FadeSwap>
            </Pressable>
          )}
        </View>

        {done && (
          <Animated.View
            entering={fadeIn(Duration.slow)}
            style={styles.list}
            onLayout={(e) => (listY.current = e.nativeEvent.layout.y)}>
            {transcript.map((s, i) => (
              <Segment
                key={`${s.start}-${i}`}
                testID={transcriptSegment(i)}
                segment={s}
                active={i === active}
                onPress={onSeek}
                onLayoutY={(y) => {
                  segmentY.current[i] = y;
                }}
              />
            ))}
          </Animated.View>
        )}

        {waitingForModel && (
          <Notice
            icon="hourglass-outline"
            tint={Colors.warning}
            title="Waiting for a speech model"
            body="Download a model in Profile and this recording is transcribed automatically."
            action="Open Profile"
            actionIcon="cloud-download-outline"
            onAction={() => router.navigate('/profile')}
          />
        )}

        {transcriptStatus === 'processing' && !waitingForModel && (
          <View testID={TestIDs.detail.processing}>
            <View style={styles.processingRow}>
              <ActivityIndicator size="small" color={Colors.labelSecondary} />
              <Text style={styles.processingText}>
                {recording.transcriptProgress === undefined
                  ? 'Queued for transcription…'
                  : `Transcribing on device… ${Math.round(recording.transcriptProgress * 100)}%`}
              </Text>
              <View style={styles.flex} />
              {onCancel && (
                <Pressable
                  testID={TestIDs.detail.cancelTranscription}
                  onPress={() => {
                    haptic.light();
                    onCancel();
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel transcription"
                  style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.6 }]}>
                  <Ionicons name="close" size={15} color={Colors.record} />
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              )}
            </View>
            <SkeletonLines />
          </View>
        )}

        {transcriptStatus === 'failed' && (
          <Notice
            icon="alert-circle"
            tint={Colors.record}
            title="Transcription failed"
            body={recording.transcriptError ?? 'We couldn’t turn this recording into text. Please try again.'}
            action="Retry"
            onAction={onRetry}
          />
        )}

        {transcriptStatus === 'done' && transcript.length === 0 && (
          <Notice
            icon="mic-off-outline"
            tint={Colors.labelSecondary}
            title="No speech detected"
            body="Whisper didn’t hear any words in this recording. Try again with a larger model, or record closer to the microphone."
            action="Try Again"
            onAction={onRetry}
          />
        )}

        {transcriptStatus === 'none' && (
          <Notice
            icon="document-text-outline"
            tint={Colors.tint}
            title="No transcript yet"
            body="Generate a time-coded transcript you can search, copy and follow along with."
            action="Transcribe"
            onAction={onRetry}
          />
        )}
      </View>
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  heading: {
    ...Type.title3,
  },
  flex: { flex: 1 },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    height: 30,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.tintSoft,
  },
  copyInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  copyText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.tint,
  },
  list: {
    gap: Spacing.xxs,
  },
  segment: {
    borderRadius: Radius.md,
    marginHorizontal: -Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  stamp: {
    ...Type.caption,
    fontVariant: ['tabular-nums'],
    color: Colors.labelTertiary,
    marginBottom: Spacing.xxs + 1,
  },
  segmentText: {
    ...Type.body,
    fontSize: 19,
    lineHeight: 32,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  processingText: {
    ...Type.subhead,
    flexShrink: 1,
  },
  cancel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    height: 30,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.recordSoft,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.record,
  },
  skeleton: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  skeletonLine: {
    height: 13,
    borderRadius: 6.5,
  },
  notice: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  noticeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  noticeTitle: {
    ...Type.headline,
    textAlign: 'center',
  },
  noticeBody: {
    ...Type.subhead,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 20,
    maxWidth: 300,
  },
  noticeButton: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    height: 38,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
    backgroundColor: Colors.label,
  },
  noticeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.24,
    color: '#FFFFFF',
  },
});
