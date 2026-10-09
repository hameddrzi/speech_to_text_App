# Design system

The look is **white, airy and frosted**, modeled on Apple's Voice Memos: a clean white canvas,
soft pastel light behind it, and translucent glass surfaces for every card, pill and bar.

Every screen takes its colors, type, spacing and radii from `src/constants/theme.ts`, and every
raised surface uses `<Glass>` from `src/components/glass.tsx`. Following those two rules keeps the
app looking like one system.

## The glass material: `<Glass>`

A `<Glass>` surface is five layers stacked on top of each other:

```
┌──────────────────────────────┐  5. hairline border    rgba(15,23,42,0.06), defines the edge
│┌────────────────────────────┐│  4. bright inner rim   white 0.9, catches the "light"
││ ░░░ specular highlight ░░░ ││  3. top-down gradient  white 0.65 → 0, the shine
││   translucent white fill   ││  2. white fill         0.55 (iOS) / 0.86 (Android)
││        backdrop blur       ││  1. BlurView           iOS and web only
│└────────────────────────────┘│
└──────────────────────────────┘
```

```tsx
import { Glass } from '@/components/glass';
import { Radius } from '@/constants/theme';

<Glass radius={Radius.xl} strong intensity={50}>
  {/* content */}
</Glass>
```

| Prop | Default | Use |
|---|---|---|
| `intensity` | `40` | Blur strength, 0–100 |
| `radius` | `Radius.lg` (20) | Corner radius |
| `strong` | `false` | More opaque fill, for dense text such as lists and sheets |
| `elevated` | `true` | Soft drop shadow (iOS); turn off for small inline pills |

### Android differences

Android can't reliably blur what's behind a rounded view, and it draws elevation shadows through
translucent surfaces as a grey box. So on Android, `<Glass>`:

- skips the `BlurView` and uses a more opaque white fill (0.86 instead of 0.55),
- removes the elevation shadow, letting the border and fill define the shape.

The result still reads as frosted white glass, just a little more solid. Always check new UI on
both platforms.

### The background: `<AmbientBackground>`

Glass needs something behind it to look like glass. Each tab places three large, very soft pastel
blobs (`blobA` peach, `blobB` sky blue, `blobC` lavender) in a different arrangement per screen.
They are subtle enough that the screen still reads as white. Each blob is an SVG radial gradient that
fades to fully transparent, so it has no edge on any platform (Android has no reliable blur view).

## Color

| Token | Value | Use |
|---|---|---|
| `background` | `#FFFFFF` | Screen background |
| `backgroundGrouped` | `#F5F6F8` | Grouped areas |
| `label` | `#0B0B0F` | Primary text |
| `labelSecondary` | 62 % gray | Secondary text, metadata |
| `labelTertiary` | 32 % gray | Placeholders, disabled |
| `separator` | 12 % gray | Dividers |
| `record` | `#FF3B30` | Record button, live waveform, destructive actions |
| `tint` | `#0A84FF` | Links, selection, *Transcribing* state |
| `success` | `#34C759` | *Transcript* (transcribed) state |
| `warning` | `#FF9F0A` | Warnings |

Every accent also has a `…Soft` variant (10–12 % opacity) for chip backgrounds.
The color logic follows iOS: **red means recording**, **blue means interactive**, everything else is
black and gray on white.

## Typography

The system font (SF on iOS, Roboto on Android), on the iOS type scale:

| Token | Size / weight | Use |
|---|---|---|
| `largeTitle` | 34 / bold | Screen titles ("Record", "All Recordings") |
| `title2` | 22 / bold | Section titles |
| `title3` | 20 / semibold | Card titles |
| `headline` | 17 / semibold | Row titles |
| `body` | 17 / regular | Transcript text |
| `callout` | 16 / regular | Supporting text |
| `subhead` | 15 / regular, secondary | Metadata |
| `footnote` | 13 / regular, secondary | Section footers |
| `caption` | 12 / medium, secondary | Chips, labels |
| `timer` | 56 / light, tabular digits | The recording timer |

The timer uses **tabular numbers**, so the digits don't jump left and right as they change.

## Spacing, radius and shadow

```
Spacing   xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32 · huge 48
Radius    sm 10 · md 14 · lg 20 · xl 28 · pill 999
Shadow    soft (cards) · lifted (floating controls)
```

- Screen side padding: `ScreenPadding` (20).
- Every tab screen reserves `TabBarHeight + TabBarBottomGap` at the bottom for the floating tab bar.

## Motion and feedback

- Small controls (record button morph, switches, tab lens, press feedback) use **well-damped Reanimated
  springs** (damping ratio ≥ 0.86, so they land without a visible wobble).
- Anything that appears over the screen (sheets, toasts, notices) uses a short **timing** curve, never a spring:
  ease-out in (~250 ms), ease-in out (~190 ms). Sheets go through `<BottomSheet>`
  (`src/components/bottom-sheet.tsx`), which slides out before unmounting its Modal.
- **Never build animated colors or sizes with template strings** (`` `rgba(0,0,0,${v})` ``). A settling
  animation reaches values like `1e-8`, and Android crashes on the resulting `rgba(0,0,0,1e-8)`.
  Use `interpolateColor`, or format numbers with `toFixed`.
- Prefer animating `transform` and `opacity` over `width`/`height`, so animations don't trigger layout.
- Selections and key actions trigger a light **haptic** tap. Always go through `haptic` in
  `src/utils/haptics.ts` (never `expo-haptics` directly), so the Haptics switch in Profile is respected.
- The app's **React Compiler** is on, so components are memoized automatically; avoid hand-written
  `useMemo` / `useCallback` unless profiling shows a need.

### Motion tokens: `src/constants/motion.ts`

Every animation takes its numbers from `motion.ts`, never from inline literals:

| Export | What it holds |
|---|---|
| `Duration` | `press` 90 · `fast` 160 · `exit` 190 · `base` 220 · `enter` 250 · `slow` 320 · `progress` 480 · `tabFade` 180 ms |
| `Easings` | `out` (arrivals), `in` (departures), `inOut` (changes in place) as cubic beziers, plus `breathe` for loops and `linear` |
| `Timing` | ready `withTiming` configs: `enter`, `exit`, `change`, `fast`, `pressIn`, `pressOut`, `progress`, and `fade` / `fadeFast` (opacity only, kept with reduced motion) |
| `Spring` | `press` (ratio 1), `control` (0.86, lenses / switches / knobs), `morph` (0.9, record button) |
| `PressScale`, `Travel`, `Stagger` | press-in scales (row 0.98, button 0.94, control 0.9), slide distances, list stagger |
| `fadeIn()`, `fadeOut()`, `riseIn()`, `listLayout` | layout-animation presets (`entering` / `exiting` / `layout`) |
| `useMotion()` | `{ reduced, distance(px) }`: the OS reduce-motion flag, and travel that collapses to 0 when it is on |

Two helpers build on it:

- `<FadeSwap swapKey>` (`src/components/fade-swap.tsx`) cross-fades content that changes in place (status
  chips, "Copied", the record status line, Get → Downloading → Model Ready). Only the new content fades in;
  nothing animates on first mount.
- `useListIntroClock()` / `introProgress()` (`src/components/archive/list-intro.tsx`) run the archive's one-time
  staggered entrance from one shared clock, as an animated style instead of `entering`, so it never fights the
  list's layout transitions (on web, `entering` on these rows broke the filter-change transitions).

Rules:

- **Animate `transform` and `opacity`.** Morphs are a scale (the record button), masks are opposite translations
  (the waveform scrubber's played part), bars rise inside a clipped slot (Profile stats), progress fills use
  `scaleX`. The Storage bar's stacked segments are the one width animation; they change only when storage does.
- **Colors go through `interpolateColor`** (tab labels, timer, transcript highlight, switch track, settings rows).
- **Reduced motion:** Reanimated skips `withTiming` / `withSpring` / layout animations by default when the OS asks
  for less motion, so values jump to their end. Pure fades opt back in with `Timing.fade` or `fadeIn()`, anything
  that slides uses `useMotion().distance()`, and loops (halo pulse, blinking dot, listening dots) stop.
- **Never block or delay.** Animations don't gate touches or navigation; only a picked option waits `Duration.fast`
  so its checkmark moves before the sheet closes.
- **Screen transitions:** the detail screen pushes with `animation: 'ios_from_right'` (Android gets the iOS-style
  slide; iOS keeps its native push), and tabs cross-fade (`animation: 'fade'`, `Duration.tabFade`).
- On web, layout animations only understand bezier easings, which is why `Easings` are written as beziers.

## Rules for new UI

1. **No hard-coded colors, sizes or radii.** Use the tokens in `theme.ts`, and add a token there
   if one is missing.
2. **Every raised surface is a `<Glass>`.** Don't build one-off translucent views.
3. **Keep the background white.** Color comes from the accent tokens and the ambient blobs only.
4. **Red is reserved for recording and deleting.**
5. **Test on Android as well as iOS.** Glass looks different on each.
6. **Set accessibility labels and roles** on every custom control (see `record-button.tsx`).

## App icon

The icon (a red waveform turning into transcript lines) is drawn in `assets/icon/icon.svg`. Edit
that file, then run `node scripts/export-icons.js` (needs Playwright + Chromium) to regenerate the
layer SVGs, the iOS Icon Composer layers in `assets/expo.icon/` and every PNG in `assets/images/`.
Rebuild the native apps afterwards (`npx expo prebuild --clean`).
