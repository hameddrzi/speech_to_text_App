import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { Duration, riseIn, Travel, useMotion } from '@/constants/motion';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

type Props = {
  kind: 'empty' | 'no-results' | 'no-favorites' | 'no-transcripts';
  query?: string;
};

const COPY: Record<Props['kind'], { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }> = {
  empty: {
    icon: 'mic',
    title: 'No Recordings',
    body: 'Tap Record to capture your first voice memo. It will appear here with its transcript.',
  },
  'no-results': { icon: 'search', title: 'No Results', body: 'Nothing matches “%q” in titles or transcripts.' },
  'no-favorites': { icon: 'star', title: 'No Favorites', body: 'Swipe left on a recording and tap the star to keep it here.' },
  'no-transcripts': {
    icon: 'document-text',
    title: 'No Transcripts Yet',
    body: 'Finished transcripts will show up here as soon as they are ready.',
  },
};

const BARS = [0.35, 0.6, 0.9, 0.55, 1, 0.7, 0.4, 0.8, 0.5, 0.3];

/** Glass "illustration" card: a stacked waveform plate with a floating glass badge. */
export function EmptyState({ kind, query = '' }: Props) {
  const copy = COPY[kind];
  const { reduced } = useMotion();
  return (
    // Keyed by kind in the list, so switching filters into another empty state also eases in.
    <Animated.View entering={riseIn(reduced, { duration: Duration.slow, distance: Travel.empty })} style={styles.wrap}>
      <Glass strong radius={Radius.xl} style={styles.card}>
        <View style={styles.art}>
          <Glass radius={Radius.lg} elevated={false} style={[styles.plate, styles.plateBack]} />
          <Glass radius={Radius.lg} style={styles.plate}>
            <View style={styles.bars}>
              {BARS.map((h, i) => (
                <View
                  key={i}
                  style={[styles.bar, { height: 8 + h * 34, opacity: 0.35 + h * 0.5 }]}
                />
              ))}
            </View>
          </Glass>
          <Glass radius={Radius.pill} style={styles.badge}>
            <Ionicons name={copy.icon} size={20} color={kind === 'empty' ? Colors.record : Colors.tint} />
          </Glass>
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body.replace('%q', query.trim())}</Text>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: Spacing.xxl,
  },
  card: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xxl,
  },
  art: {
    width: 170,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  plate: {
    width: 150,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateBack: {
    position: 'absolute',
    top: 8,
    width: 128,
    opacity: 0.7,
    transform: [{ rotate: '-6deg' }],
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bar: {
    width: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.wavePlayed,
  },
  badge: {
    position: 'absolute',
    right: 2,
    bottom: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Type.title3,
    textAlign: 'center',
  },
  body: {
    ...Type.subhead,
    textAlign: 'center',
    marginTop: Spacing.xs + 2,
    lineHeight: 20,
    maxWidth: 280,
  },
});
