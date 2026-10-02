import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

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

/**
 * White canvas with very soft, out-of-focus pastel light so the frosted glass above it has something to refract.
 * Place it as the first child of a screen (it fills absolutely and ignores touches).
 */
export function AmbientBackground({ variant = 'record' }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.background }]} />
      {LAYOUTS[variant].map((b, i) => (
        <LinearGradient
          key={i}
          colors={[b.color, 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: 'absolute',
            top: b.top,
            left: b.left,
            width: b.size,
            height: b.size,
            borderRadius: b.size / 2,
            opacity: 0.7,
          }}
        />
      ))}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.35)' }]} />
    </View>
  );
}
