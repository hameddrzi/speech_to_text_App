import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { confirmDelete } from '@/components/archive/actions';
import { EmptyState } from '@/components/archive/empty-state';
import { haptic } from '@/components/archive/haptics';
import { RecordingRow, ROW_LAYOUT } from '@/components/archive/recording-row';
import { SearchField } from '@/components/archive/search-field';
import { SegmentedControl } from '@/components/archive/segmented-control';
import { Glass } from '@/components/glass';
import { Colors, ScreenPadding, Spacing, TabBarBottomGap, TabBarHeight, Type } from '@/constants/theme';
import { transcriptText, type Recording } from '@/data/recordings';
import { useRecordings } from '@/store/recordings';

type Filter = 'all' | 'favorites' | 'transcribed';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'transcribed', label: 'Transcribed' },
] as const satisfies readonly { value: Filter; label: string }[];

const COMPACT_BAR_HEIGHT = 44;

function summary(list: Recording[]): string {
  const minutes = Math.round(list.reduce((sum, r) => sum + r.duration, 0) / 60);
  const count = `${list.length} ${list.length === 1 ? 'recording' : 'recordings'}`;
  return list.length === 0 ? 'Nothing recorded yet' : `${count} · ${minutes} min`;
}

export default function ArchiveScreen() {
  const insets = useSafeAreaInsets();
  const { recordings, deleteRecording, toggleFavorite, updateRecording } = useRecordings();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const openSwipe = useRef<SwipeableMethods | null>(null);

  const data = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return recordings
      .filter((r) => {
        if (filter === 'favorites' && !r.favorite) return false;
        if (filter === 'transcribed' && r.transcriptStatus !== 'done') return false;
        if (!q) return true;
        return r.title.toLocaleLowerCase().includes(q) || transcriptText(r).toLocaleLowerCase().includes(q);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [recordings, query, filter]);

  // Large title → compact glass bar, iOS style.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const compactBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [28, 60], [0, 1], Extrapolation.CLAMP),
  }));
  const compactTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [44, 70], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.get(), [44, 70], [6, 0], Extrapolation.CLAMP) }],
  }));
  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, 44], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(scrollY.get(), [-140, 0], [1.1, 1], Extrapolation.CLAMP) }],
  }));

  const onSwipeOpen = useCallback((methods: SwipeableMethods) => {
    if (openSwipe.current && openSwipe.current !== methods) openSwipe.current.close();
    openSwipe.current = methods;
  }, []);

  const onOpen = useCallback((id: string) => {
    openSwipe.current?.close();
    router.push({ pathname: '/recording/[id]', params: { id } });
  }, []);

  const onDelete = useCallback(
    async (r: Recording) => {
      const ok = await confirmDelete(r.title);
      if (!ok) return false;
      if (openSwipe.current) openSwipe.current = null;
      deleteRecording(r.id);
      haptic.success();
      return true;
    },
    [deleteRecording],
  );

  const onRetry = useCallback(
    (id: string) => {
      haptic.light();
      // The TranscriptionWorker picks up anything in 'processing' and runs it on device.
      updateRecording(id, { transcriptStatus: 'processing', transcriptError: undefined });
    },
    [updateRecording],
  );

  const emptyKind = query.trim()
    ? 'no-results'
    : filter === 'favorites'
      ? 'no-favorites'
      : filter === 'transcribed'
        ? 'no-transcripts'
        : 'empty';

  const bottomSpace = TabBarHeight + Math.max(insets.bottom, TabBarBottomGap) + Spacing.xxl;

  return (
    <View style={styles.screen}>
      <AmbientBackground variant="archive" />

      <Animated.FlatList
        data={data}
        keyExtractor={(r) => r.id}
        itemLayoutAnimation={ROW_LAYOUT}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.sm,
          paddingBottom: bottomSpace,
          paddingHorizontal: ScreenPadding,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Animated.View style={[styles.largeTitleWrap, largeTitleStyle]}>
              <Text style={styles.eyebrow}>Archive</Text>
              <Text style={styles.largeTitle} accessibilityRole="header">
                All Recordings
              </Text>
              <Text style={styles.summary}>{summary(recordings)}</Text>
            </Animated.View>
            <SearchField value={query} onChangeText={setQuery} placeholder="Search titles & transcripts" />
            <View style={styles.segmented}>
              <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState kind={recordings.length === 0 ? 'empty' : emptyKind} query={query} />}
        renderItem={({ item }) => (
          <RecordingRow
            recording={item}
            onOpen={onOpen}
            onToggleFavorite={toggleFavorite}
            onDelete={onDelete}
            onRetry={onRetry}
            onSwipeOpen={onSwipeOpen}
          />
        )}
      />

      {/* Compact frosted bar that fades in once the large title scrolls away. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.compactBar, { height: insets.top + COMPACT_BAR_HEIGHT }, compactBarStyle]}>
        <Glass radius={0} elevated={false} intensity={60} strong style={StyleSheet.absoluteFill} />
        <View style={styles.hairline} />
        <Animated.Text
          style={[styles.compactTitle, { top: insets.top, height: COMPACT_BAR_HEIGHT }, compactTitleStyle]}>
          All Recordings
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingBottom: Spacing.lg,
  },
  largeTitleWrap: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    transformOrigin: 'left',
  },
  eyebrow: {
    ...Type.footnote,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.labelSecondary,
  },
  largeTitle: {
    ...Type.largeTitle,
    marginTop: Spacing.xxs,
  },
  summary: {
    ...Type.subhead,
    marginTop: Spacing.xxs,
  },
  segmented: {
    marginTop: Spacing.md,
  },
  compactBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separator,
  },
  compactTitle: {
    ...Type.headline,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    lineHeight: COMPACT_BAR_HEIGHT,
  },
});
