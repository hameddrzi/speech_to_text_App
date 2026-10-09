/**
 * Shared motion tokens. Every animation in the app takes its duration, curve and spring from here,
 * so the whole app moves with one rhythm. See "Motion" in docs/design-system.md for the rules.
 *
 * - Overlays (sheets, toasts, notices) use timing curves: ease-out in, ease-in out. Never springs.
 * - Small direct-manipulation controls (press feedback, record button, switches, lenses) use the
 *   critically/over-damped springs below: they settle without a visible wobble.
 * - Only `transform` and `opacity` are animated, plus colors through `interpolateColor`.
 * - Reduced motion: Reanimated skips every withTiming / withSpring / layout animation by default
 *   (`ReduceMotion.System`), so values jump to their end state. Pure opacity fades opt back in with
 *   `ReduceMotion.Never` (a fade is not "motion"), and anything that slides uses `distance()` so it
 *   stays in place when the setting is on.
 */
import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
  type WithSpringConfig,
  type WithTimingConfig,
} from 'react-native-reanimated';

/** Durations in ms. */
export const Duration = {
  /** Press-in highlight: has to feel instant. */
  press: 90,
  /** Small swaps: icons, chips, labels. */
  fast: 160,
  /** Overlays leaving. */
  exit: 190,
  /** Standard on-screen state change (highlight, color, fade). */
  base: 220,
  /** Overlays and content arriving. */
  enter: 250,
  /** Larger, ambient changes (waveform waking up, empty state). */
  slow: 320,
  /** Progress fills and chart bars. */
  progress: 480,
  /** Tab scene cross-fade. */
  tabFade: 180,
} as const;

/**
 * Curves. The cubic ones are written as bezier factories (the exact easeOut/In/InOutCubic curves) because
 * Reanimated's web layout animations only understand beziers; native treats them the same as Easing.out(cubic).
 */
export const Easings = {
  /** Arrivals and settling: fast start, soft landing. */
  out: Easing.bezier(0.33, 1, 0.68, 1),
  /** Departures: soft start, quick finish. */
  in: Easing.bezier(0.32, 0, 0.67, 0),
  /** Something changing in place. */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** Loops (breathing dots, blinking record dot). */
  breathe: Easing.inOut(Easing.quad),
  linear: Easing.linear,
} as const;

/** Ready-made `withTiming` configs. */
export const Timing = {
  enter: { duration: Duration.enter, easing: Easings.out },
  exit: { duration: Duration.exit, easing: Easings.in },
  change: { duration: Duration.base, easing: Easings.inOut },
  fast: { duration: Duration.fast, easing: Easings.out },
  pressIn: { duration: Duration.press, easing: Easings.out },
  pressOut: { duration: Duration.base, easing: Easings.out },
  progress: { duration: Duration.progress, easing: Easings.out },
  /** Opacity-only changes: these still run when the OS asks for reduced motion. */
  fade: { duration: Duration.base, easing: Easings.inOut, reduceMotion: ReduceMotion.Never },
  fadeFast: { duration: Duration.fast, easing: Easings.out, reduceMotion: ReduceMotion.Never },
} as const satisfies Record<string, WithTimingConfig>;

/**
 * Springs, written as duration + damping ratio so "no wobble" is explicit:
 * ratio 1 is critically damped, 0.86–0.9 overshoots by well under 1 %, which reads as a soft landing.
 */
export const Spring = {
  /** Press-in / press-out scale on buttons and cards. */
  press: { duration: 200, dampingRatio: 1 },
  /** Lenses, switches, thumbs: quick and settled. */
  control: { duration: 340, dampingRatio: 0.86 },
  /** The record button's circle ↔ rounded-square morph. */
  morph: { duration: 420, dampingRatio: 0.9 },
} as const satisfies Record<string, WithSpringConfig>;

/** Press-feedback scales. */
export const PressScale = {
  /** Large cards and list rows. */
  row: 0.98,
  /** Pills and medium buttons. */
  button: 0.94,
  /** Round controls. */
  control: 0.9,
} as const;

/** Small travel distances (px) for fade + slide entrances. */
export const Travel = {
  row: 10,
  toast: 12,
  hint: 6,
  empty: 14,
} as const;

/** Stagger between list items on first mount, and the cap after which items appear together. */
export const Stagger = {
  step: 35,
  maxItems: 8,
} as const;

/** True when the OS "reduce motion" setting was on at launch. */
export function useMotion() {
  const reduced = useReducedMotion();
  return {
    reduced,
    /** A travel distance that collapses to 0 when motion is reduced. */
    distance: (px: number) => (reduced ? 0 : px),
  };
}

/** Plain fade in: used for swapping content in place. Runs even with reduced motion. */
export const fadeIn = (duration: number = Duration.fast) =>
  FadeIn.duration(duration).easing(Easings.out).reduceMotion(ReduceMotion.Never);

/** Plain fade out. Runs even with reduced motion. */
export const fadeOut = (duration: number = Duration.exit) =>
  FadeOut.duration(duration).easing(Easings.in).reduceMotion(ReduceMotion.Never);

/**
 * Fade in while rising a few px into place. With reduced motion it is a plain fade.
 * `delay` is used for the archive's first-mount stagger.
 */
type RiseOptions = { delay?: number; distance?: number; duration?: number };

export function riseIn(reduced: boolean, options: RiseOptions = {}) {
  const { delay = 0, distance = Travel.row, duration = Duration.enter } = options;
  if (reduced) return fadeIn(duration);
  return FadeInDown.duration(duration)
    .delay(delay)
    .easing(Easings.out)
    .withInitialValues({ opacity: 0, translateY: distance });
}

/** List items sliding into the gap left by a removed item. */
export const listLayout = LinearTransition.duration(Duration.base).easing(Easings.inOut);
