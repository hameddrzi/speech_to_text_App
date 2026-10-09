import { useEffect } from 'react';
import { ReduceMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { Duration, Easings, Stagger } from '@/constants/motion';

/** Long enough for the last staggered item to finish. */
const INTRO_MS = Stagger.maxItems * Stagger.step + Duration.enter;

/**
 * First-mount entrance for the archive list. One shared clock runs once when the list mounts, and each item
 * derives its own staggered progress from it in an animated style (opacity + a short rise). Nothing re-renders,
 * no layout animations are involved (so it can't fight the list's layout transitions), rows mounted later by
 * scrolling or filtering simply appear, and a filter change never replays it.
 */
export function useListIntroClock(): SharedValue<number> {
  const clock = useSharedValue(0);
  useEffect(() => {
    // Linear clock; each item applies its own easing. Kept with reduced motion: items then only fade.
    clock.set(withTiming(INTRO_MS, { duration: INTRO_MS, easing: Easings.linear, reduceMotion: ReduceMotion.Never }));
  }, [clock]);
  return clock;
}

/** 0 → 1 entrance progress (eased out) of the item at `index`; 1 when there is no intro. */
export function introProgress(clock: SharedValue<number> | undefined, index: number | undefined): number {
  'worklet';
  if (!clock || index === undefined) return 1;
  const t = (clock.get() - Math.min(index, Stagger.maxItems) * Stagger.step) / Duration.enter;
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) * (1 - c) * (1 - c);
}
