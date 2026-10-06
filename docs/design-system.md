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
They are subtle enough that the screen still reads as white.

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

- Animations use **Reanimated springs**: the record button's morph, the waveform.
- Selections and key actions trigger a light **haptic** tap. Always go through `haptic` in
  `src/utils/haptics.ts` (never `expo-haptics` directly), so the Haptics switch in Profile is respected.
- The app's **React Compiler** is on, so components are memoized automatically; avoid hand-written
  `useMemo` / `useCallback` unless profiling shows a need.

## Rules for new UI

1. **No hard-coded colors, sizes or radii.** Use the tokens in `theme.ts`, and add a token there
   if one is missing.
2. **Every raised surface is a `<Glass>`.** Don't build one-off translucent views.
3. **Keep the background white.** Color comes from the accent tokens and the ambient blobs only.
4. **Red is reserved for recording and deleting.**
5. **Test on Android as well as iOS.** Glass looks different on each.
6. **Set accessibility labels and roles** on every custom control (see `record-button.tsx`).
