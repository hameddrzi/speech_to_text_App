import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { memo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { haptic } from '@/components/archive/haptics';
import { Shimmer } from '@/components/archive/shimmer';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import { transcriptText, type Recording, type TranscriptSegment } from '@/data/recordings';
import { LANGUAGE_NAMES } from '@/stt/types';
import { formatDuration, isRTL } from '@/utils/format';

type Props = {
  recording: Recording;
  position: number;
  onSeek: (seconds: number) => void;
  onRetry: () => void;
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

const Segment = memo(function Segment({
  segment,
  active,
  onPress,
  onLayoutY,
}: {
  segment: TranscriptSegment;
  active: boolean;
  onPress: (start: number) => void;
  onLayoutY: (y: number) => void;
}) {
  const rtl = isRTL(segment.text);
  const a = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    a.set(withTiming(active ? 1 : 0, { duration: 240 }));
  }, [active, a]);

  const bg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(a.get(), [0, 1], ['rgba(10,132,255,0)', 'rgba(10,132,255,0.09)']),
  }));

  return (
    <Pressable
      onPress={() => onPress(segment.start)}
      onLayout={(e) => onLayoutY(e.nativeEvent.layout.y)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${formatDuration(segment.start)}. ${segment.text}`}
      accessibilityHint="Plays from this point">
      <Animated.View style={[styles.segment, bg]}>
        <Text style={[styles.stamp, { alignSelf: rtl ? 'flex-end' : 'flex-start' }, active && styles.stampActive]}>
          {formatDuration(segment.start)}
        </Text>
        <Text
          style={[
            styles.segmentText,
            rtl ? styles.rtl : styles.ltr,
            { color: active ? Colors.label : 'rgba(60,60,67,0.78)' },
          ]}>
          {segment.text}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

function SkeletonLines({ rtl }: { rtl: boolean }) {
  const widths = ['100%', '94%', '98%', '86%', '62%'] as const;
  return (
    <View style={[styles.skeleton, { alignItems: rtl ? 'flex-end' : 'flex-start' }]}>
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
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.notice}>
      <View style={[styles.noticeIcon, { backgroundColor: `${tint}1F` }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeBody}>{body}</Text>
      <Pressable
        onPress={() => {
          haptic.light();
          onAction();
        }}
        accessibilityRole="button"
        accessibilityLabel={action}
        style={({ pressed }) => [styles.noticeButton, pressed && { opacity: 0.7 }]}>
        <Ionicons name="refresh" size={15} color="#FFFFFF" />
        <Text style={styles.noticeButtonText}>{action}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Full-page, time-coded transcript for the recording screen; follows playback and seeks on tap. */
export function TranscriptCard({ recording, position, onSeek, onRetry, onActiveSegmentChange }: Props) {
  const { transcript, transcriptStatus, language } = recording;
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

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.heading} accessibilityRole="header">
          Transcript
        </Text>
        <View style={styles.langChip}>
          <Text style={styles.langText}>{LANGUAGE_NAMES[language] ?? language}</Text>
        </View>
        <View style={styles.flex} />
        {done && (
          <Pressable
            onPress={copy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={copied ? 'Copied' : 'Copy text'}
            style={({ pressed }) => [styles.copy, pressed && { opacity: 0.6 }]}>
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={15}
              color={copied ? Colors.success : Colors.tint}
            />
            <Text style={[styles.copyText, copied && { color: Colors.success }]}>
              {copied ? 'Copied' : 'Copy text'}
            </Text>
          </Pressable>
        )}
      </View>

      {done && (
        <View style={styles.list} onLayout={(e) => (listY.current = e.nativeEvent.layout.y)}>
          {transcript.map((s, i) => (
            <Segment
              key={`${s.start}-${i}`}
              segment={s}
              active={i === active}
              onPress={onSeek}
              onLayoutY={(y) => {
                segmentY.current[i] = y;
              }}
            />
          ))}
        </View>
      )}

      {transcriptStatus === 'processing' && (
        <View>
          <View style={styles.processingRow}>
            <ActivityIndicator size="small" color={Colors.labelSecondary} />
            <Text style={styles.processingText}>
              {recording.transcriptProgress
                ? `Transcribing on device… ${Math.round(recording.transcriptProgress * 100)}%`
                : 'Transcribing on device…'}
            </Text>
          </View>
          <SkeletonLines rtl={language === 'fa'} />
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

      {(transcriptStatus === 'none' || (transcriptStatus === 'done' && transcript.length === 0)) && (
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
    paddingHorizontal: Spacing.xs,
  },
  heading: {
    ...Type.title3,
  },
  langChip: {
    paddingHorizontal: Spacing.sm,
    height: 22,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(118,118,128,0.10)',
    justifyContent: 'center',
  },
  langText: {
    ...Type.caption,
    fontSize: 11,
    fontWeight: '600',
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
  stampActive: {
    color: Colors.tint,
  },
  segmentText: {
    ...Type.body,
    fontSize: 19,
    lineHeight: 32,
  },
  rtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  ltr: {
    textAlign: 'left',
    writingDirection: 'ltr',
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
