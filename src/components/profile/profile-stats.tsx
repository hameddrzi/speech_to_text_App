import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import type { Recording } from '@/data/recordings';
import { formatDuration, formatTotalTime } from '@/utils/format';

type IconName = keyof typeof Ionicons.glyphMap;


const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CHART_HEIGHT = 72;

function useStats(recordings: Recording[]) {
  return useMemo(() => {
    const totalSeconds = recordings.reduce((sum, r) => sum + r.duration, 0);
    const transcribed = recordings.filter((r) => r.transcriptStatus === 'done').length;
    const favorites = recordings.filter((r) => r.favorite).length;
    const longest = recordings.reduce((max, r) => Math.max(max, r.duration), 0);

    // Last 7 days, oldest → today.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return { start: d.getTime(), label: WEEKDAY[d.getDay()], seconds: 0 };
    });
    for (const r of recordings) {
      const t = new Date(r.createdAt).getTime();
      const day = days.find((d) => t >= d.start && t < d.start + 86_400_000);
      if (day) day.seconds += r.duration;
    }
    const weekSeconds = days.reduce((sum, d) => sum + d.seconds, 0);

    return { totalSeconds, transcribed, favorites, longest, days, weekSeconds };
  }, [recordings]);
}

function StatTile({ icon, color, value, label }: { icon: IconName; color: string; value: string; label: string }) {
  return (
    <Glass strong radius={Radius.lg} style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.tileIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={15} color="#FFFFFF" />
      </View>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </Glass>
  );
}

function Bar({ fraction, index, highlight }: { fraction: number; index: number; highlight: boolean }) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.set(withDelay(index * 45, withSpring(fraction, { damping: 18, stiffness: 140 })));
  }, [fraction, index, h]);
  const style = useAnimatedStyle(() => ({ height: Math.max(4, h.value * CHART_HEIGHT) }));
  return (
    <View style={styles.barSlot}>
      <Animated.View style={[styles.bar, { backgroundColor: highlight ? Colors.record : 'rgba(255,59,48,0.28)' }, style]} />
    </View>
  );
}

/** 2×2 glass stat tiles + Health-style 7-day activity chart (minutes recorded per day). */
export function ProfileStats({ recordings }: { recordings: Recording[] }) {
  const s = useStats(recordings);
  const max = Math.max(...s.days.map((d) => d.seconds), 1);

  return (
    <View style={styles.root}>
      <View style={styles.grid}>
        <StatTile icon="mic" color={Colors.record} value={String(recordings.length)} label="Recordings" />
        <StatTile icon="time" color={Colors.warning} value={formatTotalTime(s.totalSeconds)} label="Recorded" />
      </View>
      <View style={styles.grid}>
        <StatTile icon="document-text" color={Colors.tint} value={String(s.transcribed)} label="Transcribed" />
        <StatTile icon="heart" color="#FF2D55" value={String(s.favorites)} label="Favorites" />
      </View>

      <Glass
        strong
        radius={Radius.lg}
        style={styles.chartCard}
        accessible
        accessibilityLabel={`Activity this week: ${formatTotalTime(s.weekSeconds)} recorded`}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartEyebrow}>THIS WEEK</Text>
            <Text style={styles.chartValue}>
              {formatTotalTime(s.weekSeconds)}
              <Text style={styles.chartUnit}> recorded</Text>
            </Text>
          </View>
          {s.longest > 0 && (
            <View style={styles.longest}>
              <Text style={styles.chartEyebrow}>LONGEST</Text>
              <Text style={styles.longestValue}>{formatDuration(s.longest)}</Text>
            </View>
          )}
        </View>
        <View style={styles.chart}>
          {s.days.map((d, i) => (
            <View key={d.start} style={styles.barColumn}>
              <Bar fraction={d.seconds / max} index={i} highlight={i === 6} />
              <Text style={[styles.barLabel, i === 6 && styles.barLabelToday]}>{d.label}</Text>
            </View>
          ))}
        </View>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  tile: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
  },
  tileIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  tileValue: {
    ...Type.title2,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
  tileLabel: {
    ...Type.footnote,
    marginTop: 1,
  },
  chartCard: {
    padding: Spacing.lg,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  chartEyebrow: {
    ...Type.caption,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: Colors.labelSecondary,
  },
  chartValue: {
    ...Type.title3,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  chartUnit: {
    ...Type.subhead,
  },
  longest: {
    alignItems: 'flex-end',
  },
  longestValue: {
    ...Type.headline,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  barSlot: {
    height: CHART_HEIGHT,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '62%',
    maxWidth: 22,
    borderRadius: 6,
  },
  barLabel: {
    ...Type.caption,
    fontSize: 11,
    color: Colors.labelTertiary,
  },
  barLabelToday: {
    color: Colors.label,
    fontWeight: '700',
  },
});
