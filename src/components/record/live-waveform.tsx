import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Colors, Spacing, Type } from '@/constants/theme';
import type { RecordPhase, WaveSample } from '@/hooks/record-session';

type Props = {
  samples: WaveSample[];
  phase: RecordPhase;
  /** Interval between samples; the strip glides one bar per tick so motion stays continuous. */
  tickMs: number;
  height: number;
  /** Shown over the flat line while idle. */
  hint?: string;
};

const BAR_WIDTH = 3;
const BAR_GAP = 2;
const STEP = BAR_WIDTH + BAR_GAP;
const DOT_SPACING = 7;
/** Playhead sits a little right of center so more history is visible. */
const PLAYHEAD_RATIO = 0.62;

/**
 * Voice Memos-style live waveform: red bars scroll right→left and are born at a fixed red playhead.
 * Idle: a calm dotted baseline with a soft hint.
 */
export function LiveWaveform({ samples, phase, tickMs, height, hint }: Props) {
  const [width, setWidth] = useState(0);
  const active = phase === 'recording' || phase === 'paused' || samples.length > 0;
  const playheadX = Math.round(width * PLAYHEAD_RATIO);
  const capacity = Math.ceil(playheadX / STEP) + 2;
  const visible = samples.length > capacity ? samples.slice(samples.length - capacity) : samples;
  const lastId = samples.length ? samples[samples.length - 1].id : 0;
  const maxBar = height - Spacing.xxl;

  const shift = useSharedValue(0);
  const presence = useSharedValue(active ? 1 : 0);

  // Each new bar arrives shifted one step right and glides into place over one tick.
  useEffect(() => {
    if (!lastId) return;
    shift.value = STEP;
    shift.value = withTiming(0, { duration: tickMs, easing: Easing.linear });
  }, [lastId, tickMs, shift]);

  useEffect(() => {
    presence.value = withTiming(active ? 1 : 0, { duration: 320 });
  }, [active, presence]);

  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));
  const playheadStyle = useAnimatedStyle(() => ({ opacity: presence.value }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: 1 - presence.value,
    transform: [{ translateY: presence.value * 6 }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const dotsFrom = active ? playheadX : 0;
  const dotCount = width ? Math.max(0, Math.floor((width - dotsFrom) / DOT_SPACING)) : 0;
  const barColor = phase === 'paused' ? 'rgba(255,59,48,0.55)' : Colors.waveActive;

  return (
    <View
      style={[styles.root, { height }]}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={active ? 'Live audio waveform' : 'Waveform, idle'}>
      {/* Dotted baseline (future / idle) */}
      <View style={[styles.dots, { left: dotsFrom, top: height / 2 - 1 }]} pointerEvents="none">
        {Array.from({ length: dotCount }, (_, i) => (
          <View key={i} style={styles.dot} />
        ))}
      </View>

      {/* Recorded bars, clipped at the playhead */}
      {width > 0 && (
        <View style={[styles.clip, { width: playheadX }]} pointerEvents="none">
          <Animated.View style={[styles.track, trackStyle]}>
            {visible.map((s) => (
              <View
                key={s.id}
                style={[
                  styles.bar,
                  { height: Math.max(2, s.v * maxBar), backgroundColor: barColor },
                ]}
              />
            ))}
          </Animated.View>
        </View>
      )}

      {/* Playhead */}
      {width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.playhead, { left: playheadX - 5 }, playheadStyle]}>
          <View style={styles.playheadKnob} />
          <View style={styles.playheadLine} />
          <View style={styles.playheadKnob} />
        </Animated.View>
      )}

      {hint ? (
        <Animated.View style={[styles.hintWrap, hintStyle]} pointerEvents="none">
          <Text style={styles.hint}>{hint}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    justifyContent: 'center',
  },
  dots: {
    position: 'absolute',
    right: 0,
    height: 2,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    marginRight: DOT_SPACING - 2,
    backgroundColor: Colors.waveIdle,
  },
  clip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  track: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bar: {
    width: BAR_WIDTH,
    marginLeft: BAR_GAP,
    borderRadius: BAR_WIDTH / 2,
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 10,
    alignItems: 'center',
  },
  playheadLine: {
    flex: 1,
    width: 2,
    borderRadius: 1,
    backgroundColor: Colors.record,
  },
  playheadKnob: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.record,
    marginVertical: -1,
  },
  hintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '58%',
    alignItems: 'center',
  },
  hint: {
    ...Type.subhead,
    color: Colors.labelTertiary,
  },
});

