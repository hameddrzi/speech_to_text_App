/**
 * Design tokens — white, airy, iOS Voice Memos inspired, with frosted-glass surfaces.
 * Every screen must pull colors, radii, spacing and type from here so the app reads as one system.
 */

import { Platform, type TextStyle } from 'react-native';

export const Colors = {
  // Surfaces
  background: '#FFFFFF',
  backgroundGrouped: '#F5F6F8',

  // Glass
  // Android has no reliable backdrop blur, so its frosted fill is more opaque to keep text behind it unreadable.
  glassFill: Platform.OS === 'android' ? 'rgba(255,255,255,0.86)' : 'rgba(255,255,255,0.55)',
  glassFillStrong: Platform.OS === 'android' ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.78)',
  glassBorder: 'rgba(255,255,255,0.9)',
  glassHairline: 'rgba(15,23,42,0.06)',
  glassShadow: '#0F172A',

  // Text (iOS label hierarchy)
  label: '#0B0B0F',
  labelSecondary: 'rgba(60,60,67,0.62)',
  labelTertiary: 'rgba(60,60,67,0.32)',
  separator: 'rgba(60,60,67,0.12)',

  // Accents
  record: '#FF3B30',
  recordSoft: 'rgba(255,59,48,0.12)',
  tint: '#0A84FF',
  tintSoft: 'rgba(10,132,255,0.10)',
  success: '#34C759',
  successSoft: 'rgba(52,199,89,0.12)',
  /** Darker green for text on successSoft (the accent itself is too light to read). */
  successText: '#1F8A3B',
  warning: '#FF9F0A',
  warningSoft: 'rgba(255,159,10,0.14)',
  /** Darker orange for text on warningSoft. */
  warningText: '#B86E00',

  // Waveform
  waveActive: '#FF3B30',
  waveIdle: 'rgba(60,60,67,0.22)',
  wavePlayed: '#0B0B0F',

  // Ambient background blobs (very soft so the UI stays white)
  blobA: '#FFD6D3',
  blobB: '#D6E8FF',
  blobC: '#EDE3FF',
} as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
  web: { sans: 'system-ui, -apple-system, sans-serif', rounded: 'ui-rounded, system-ui', mono: 'ui-monospace, monospace' },
});

export const Type = {
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: 0.37, color: Colors.label },
  title2: { fontSize: 22, fontWeight: '700', letterSpacing: 0.35, color: Colors.label },
  title3: { fontSize: 20, fontWeight: '600', letterSpacing: 0.38, color: Colors.label },
  headline: { fontSize: 17, fontWeight: '600', letterSpacing: -0.41, color: Colors.label },
  body: { fontSize: 17, fontWeight: '400', letterSpacing: -0.41, color: Colors.label },
  callout: { fontSize: 16, fontWeight: '400', letterSpacing: -0.32, color: Colors.label },
  subhead: { fontSize: 15, fontWeight: '400', letterSpacing: -0.24, color: Colors.labelSecondary },
  footnote: { fontSize: 13, fontWeight: '400', letterSpacing: -0.08, color: Colors.labelSecondary },
  caption: { fontSize: 12, fontWeight: '500', letterSpacing: 0, color: Colors.labelSecondary },
  timer: {
    fontSize: 56,
    fontWeight: '300',
    letterSpacing: -1,
    color: Colors.label,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },
} as const;

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const Shadow = {
  soft: {
    shadowColor: Colors.glassShadow,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  lifted: {
    shadowColor: Colors.glassShadow,
    shadowOpacity: 0.14,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
} as const;

/** Height reserved at the bottom of every tab screen for the floating glass tab bar. */
export const TabBarHeight = 64;
export const TabBarBottomGap = 12;
export const ScreenPadding = Spacing.xl;
