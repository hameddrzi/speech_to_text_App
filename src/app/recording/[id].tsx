import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { confirmDelete, shareRecording } from '@/components/archive/actions';
import { ExportSheet } from '@/components/archive/export-sheet';
import { haptic } from '@/utils/haptics';
import { GlassIconButton, PlayButton, SkipButton, SpeedPill } from '@/components/archive/playback-controls';
import { TranscriptCard } from '@/components/archive/transcript-card';
import { SKIP_SECONDS, usePlayback } from '@/components/archive/use-playback';
import { WaveformScrubber } from '@/components/archive/waveform-scrubber';
import { Glass } from '@/components/glass';
import { Colors, Radius, ScreenPadding, Shadow, Spacing, Type } from '@/constants/theme';
import type { Recording } from '@/data/recordings';
import { useRecordings } from '@/store/recordings';
import { formatDuration, formatRecordingDate } from '@/utils/format';

const HEADER_HEIGHT = 56;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/archive');
}

export default function RecordingDetailScreen() {
  const { id, t } = useLocalSearchParams<{ id: string; t?: string }>();
  const { getById } = useRecordings();
  const recording = getById(id);

  if (!recording) return <NotFound />;
  return <RecordingDetail key={recording.id} recording={recording} initialPosition={Number(t) || 0} />;
}

function NotFound() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
      <AmbientBackground variant="archive" />
      <Glass strong radius={Radius.xl} style={styles.notFound}>
        <Ionicons name="alert-circle-outline" size={32} color={Colors.labelSecondary} />
        <Text style={[Type.headline, styles.notFoundTitle]}>Recording not found</Text>
        <Text style={[Type.subhead, styles.centerText]}>It may have been deleted.</Text>
        <Pressable onPress={goBack} accessibilityRole="button" style={styles.notFoundButton}>
          <Text style={styles.notFoundButtonText}>Back to Archive</Text>
        </Pressable>
      </Glass>
    </View>
  );
}

/** Tap-to-rename large title. Commits on submit / blur. */
function EditableTitle({ title, onRename }: { title: string; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== title) {
      haptic.success();
      onRename(next);
    } else {
      setDraft(title);
    }
  };

  if (editing) {
    return (
      <TextInput
        value={draft}
        onChangeText={setDraft}
        autoFocus
        selectTextOnFocus
        onSubmitEditing={commit}
        onBlur={commit}
        returnKeyType="done"
        maxLength={80}
        style={[styles.title, styles.titleInput]}
        accessibilityLabel="Recording title"
      />
    );
  }

  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        setDraft(title);
        setEditing(true);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. Rename`}
      accessibilityHint="Double tap to edit the title"
      style={styles.titleRow}>
      {/* The pencil is nested in the text so it follows the last line instead of drifting right on wrap. */}
      <Text style={styles.title}>
        {title}
        {'\u00A0\u00A0'}
        <Ionicons name="pencil" size={17} color={Colors.labelTertiary} />
      </Text>
    </Pressable>
  );
}

function RecordingDetail({ recording, initialPosition }: { recording: Recording; initialPosition: number }) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { updateRecording, toggleFavorite, deleteRecording } = useRecordings();
  const pb = usePlayback(recording, { initialPosition });
  const { pause } = pb;
  const [scrub, setScrub] = useState<number | null>(null);
  const [transcriptTop, setTranscriptTop] = useState(0);
  const [dockHeight, setDockHeight] = useState(200);
  const [exportOpen, setExportOpen] = useState(false);

  useFocusEffect(useCallback(() => () => pause(), [pause]));

  // Scroll-linked header + transcript auto-follow.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const lastDrag = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
    },
    onBeginDrag: () => {
      lastDrag.set(Date.now());
    },
    onEndDrag: () => {
      lastDrag.set(Date.now());
    },
  });
  const headerBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [10, 50], [0, 1], Extrapolation.CLAMP),
  }));
  const headerTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [50, 90], [0, 1], Extrapolation.CLAMP),
  }));

  const playing = pb.playing;
  const onActiveSegmentChange = useCallback(
    (y: number) => {
      // Follow along like lyrics, but never fight a user who just scrolled.
      if (!playing || Date.now() - lastDrag.get() < 3000) return;
      const visible = windowHeight - dockHeight;
      scrollRef.current?.scrollTo({ y: Math.max(0, transcriptTop + y - visible * 0.35), animated: true });
    },
    [playing, lastDrag, scrollRef, transcriptTop, windowHeight, dockHeight],
  );

  const duration = pb.duration;
  const shownTime = scrub !== null ? scrub * duration : pb.position;
  const progress = duration > 0 ? pb.position / duration : 0;

  const onSeek = useCallback(
    (f: number) => {
      setScrub(null);
      pb.seek(f * duration);
    },
    [pb, duration],
  );

  const onSegmentSeek = useCallback(
    (seconds: number) => {
      haptic.selection();
      pb.seek(seconds);
      if (!pb.playing) pb.play();
    },
    [pb],
  );

  const onRetry = useCallback(() => {
    // The TranscriptionWorker picks up anything in 'processing' and runs it on device.
    updateRecording(recording.id, { transcriptStatus: 'processing', transcriptError: undefined });
  }, [recording.id, updateRecording]);

  const onDelete = async () => {
    haptic.warning();
    if (!(await confirmDelete(recording.title))) return;
    pause();
    goBack();
    deleteRecording(recording.id);
  };

  return (
    <View style={styles.screen}>
      <AmbientBackground variant="archive" />

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + HEADER_HEIGHT + Spacing.sm,
          paddingBottom: dockHeight + Spacing.xl,
          paddingHorizontal: ScreenPadding,
        }}>
        <EditableTitle title={recording.title} onRename={(title) => updateRecording(recording.id, { title })} />
        <Text style={styles.meta}>
          {formatRecordingDate(recording.createdAt)} · {formatDuration(recording.duration)}
        </Text>

        <View onLayout={(e) => setTranscriptTop(e.nativeEvent.layout.y)} style={styles.transcriptWrap}>
          <TranscriptCard
            recording={recording}
            position={pb.position}
            onSeek={onSegmentSeek}
            onRetry={onRetry}
            onActiveSegmentChange={onActiveSegmentChange}
          />
        </View>
      </Animated.ScrollView>

      {/* Player docked at the bottom, over the transcript */}
      <View
        style={[styles.dockWrap, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}
        onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}>
        <Glass strong radius={Radius.xl} intensity={70} style={styles.dock}>
          <WaveformScrubber
            waveform={recording.waveform}
            progress={progress}
            playing={pb.playing}
            variant="large"
            height={48}
            barWidth={2.5}
            gap={2}
            onScrub={setScrub}
            onSeek={onSeek}
            accessibilityValueText={`${formatDuration(shownTime)} of ${formatDuration(duration)}`}
          />
          <View style={styles.times}>
            <Text style={styles.time}>{formatDuration(shownTime)}</Text>
            <Text style={styles.time}>-{formatDuration(duration - shownTime)}</Text>
          </View>
          <View style={styles.controls}>
            <View style={styles.side}>
              <SpeedPill rate={pb.rate} onPress={pb.cycleRate} />
            </View>
            <SkipButton direction="back" onPress={() => pb.skip(-SKIP_SECONDS)} size={30} />
            <PlayButton large playing={pb.playing} onPress={pb.toggle} />
            <SkipButton direction="forward" onPress={() => pb.skip(SKIP_SECONDS)} size={30} />
            <View style={[styles.side, styles.sideRight]}>
              <GlassIconButton
                icon={recording.favorite ? 'star' : 'star-outline'}
                color={recording.favorite ? Colors.warning : Colors.label}
                label={recording.favorite ? 'Remove from favorites' : 'Add to favorites'}
                size={36}
                iconSize={17}
                onPress={() => {
                  haptic.selection();
                  toggleFavorite(recording.id);
                }}
              />
            </View>
          </View>
        </Glass>
      </View>

      {/* Floating frosted header */}
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + HEADER_HEIGHT }]}>
        <Animated.View style={[StyleSheet.absoluteFill, headerBgStyle]} pointerEvents="none">
          <Glass radius={0} elevated={false} intensity={60} strong style={StyleSheet.absoluteFill} />
          <View style={styles.hairline} />
        </Animated.View>
        <GlassIconButton icon="chevron-back" label="Back" size={38} iconSize={20} onPress={goBack} />
        <Animated.Text numberOfLines={1} style={[styles.headerTitle, headerTitleStyle]}>
          {recording.title}
        </Animated.Text>
        <GlassIconButton
          icon="download-outline"
          label="Export transcript"
          size={38}
          iconSize={18}
          onPress={() => {
            haptic.selection();
            setExportOpen(true);
          }}
        />
        <GlassIconButton
          icon="share-outline"
          label="Share"
          size={38}
          iconSize={18}
          onPress={() => shareRecording(recording)}
        />
        <GlassIconButton
          icon="trash-outline"
          label="Delete recording"
          color={Colors.record}
          size={38}
          iconSize={18}
          onPress={onDelete}
        />
      </View>

      <ExportSheet visible={exportOpen} recording={recording} onClose={() => setExportOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ScreenPadding,
  },
  centerText: {
    textAlign: 'center',
  },
  notFound: {
    alignItems: 'center',
    padding: Spacing.xxl,
    gap: Spacing.xs,
    alignSelf: 'stretch',
  },
  notFoundTitle: {
    marginTop: Spacing.sm,
  },
  notFoundButton: {
    marginTop: Spacing.lg,
    height: 40,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
    backgroundColor: Colors.label,
    justifyContent: 'center',
  },
  notFoundButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separator,
  },
  headerTitle: {
    ...Type.headline,
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: Spacing.xs,
  },
  titleRow: {
    marginTop: Spacing.md,
  },
  title: {
    ...Type.largeTitle,
    fontSize: 30,
  },
  titleInput: {
    marginTop: Spacing.md,
    paddingVertical: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.tint,
  },
  meta: {
    ...Type.subhead,
    marginTop: Spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  dockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.md,
  },
  dock: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    ...Shadow.lifted,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xxs,
  },
  time: {
    ...Type.footnote,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  side: {
    width: 56,
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  transcriptWrap: {
    marginTop: Spacing.xl,
  },
});
