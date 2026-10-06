import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { Colors } from '@/constants/theme';

type Props = {
  /** Shift the soft color blobs so each tab feels slightly different while staying white. */
  variant?: 'record' | 'archive' | 'profile';
};

const LAYOUTS = {
  record: [
    { color: Colors.blobA, top: -120, left: -80, size: 360 },
    { color: Colors.blobB, top: 260, left: 180, size: 320 },
    { color: Colors.blobC, top: 560, left: -120, size: 300 },
  ],
  archive: [
    { color: Colors.blobB, top: -140, left: 120, size: 360 },
    { color: Colors.blobC, top: 300, left: -140, size: 320 },
    { color: Colors.blobA, top: 640, left: 160, size: 280 },
  ],
  profile: [
    { color: Colors.blobC, top: -120, left: -60, size: 380 },
    { color: Colors.blobA, top: 340, left: 200, size: 300 },
    { color: Colors.blobB, top: 620, left: -100, size: 320 },
  ],
} as const;

/** Blobs are drawn larger than their nominal size so the fade has room to dissolve into white. */
const SPREAD = 1.5;

/**
 * White canvas with very soft, out-of-focus pastel light so the frosted glass above it has something to refract.
 * Each blob is a radial gradient that fades to fully transparent, so there is never a visible edge — the same
 * look on iOS, Android and web, without relying on a blur view.
 * Place it as the first child of a screen (it fills absolutely and ignores touches).
 */
export function AmbientBackground({ variant = 'record' }: Props) {
  const blobs = LAYOUTS[variant];
  return (
    <View style={[StyleSheet.absoluteFill, styles.canvas]} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          {blobs.map((b, i) => (
            <RadialGradient key={i} id={`${variant}-blob-${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={b.color} stopOpacity={0.85} />
              <Stop offset="0.45" stopColor={b.color} stopOpacity={0.45} />
              <Stop offset="1" stopColor={b.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {blobs.map((b, i) => (
          <Circle
            key={i}
            cx={b.left + b.size / 2}
            cy={b.top + b.size / 2}
            r={(b.size / 2) * SPREAD}
            fill={`url(#${variant}-blob-${i})`}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: Colors.background,
  },
});
