import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { Colors, Radius, Shadow } from '@/constants/theme';

/**
 * Android draws elevation shadows through translucent surfaces as a grey inset box,
 * so glass stays flat there (the hairline border + white fill carry the shape).
 */
const ANDROID_FLAT = Platform.OS === 'android' ? { elevation: 0 } : null;

type GlassProps = ViewProps & {
  /** Blur strength (0–100). */
  intensity?: number;
  /** Corner radius; defaults to Radius.lg. */
  radius?: number;
  /** Stronger white fill — use for content that must stay very legible (lists, sheets). */
  strong?: boolean;
  /** Drop shadow under the glass. */
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Frosted white glass surface: blur + translucent white fill + specular top highlight + hairline border.
 * Use it for every card, sheet, pill and bar so the whole app shares one material.
 */
export function Glass({
  intensity = 40,
  radius = Radius.lg,
  strong = false,
  elevated = true,
  style,
  children,
  ...rest
}: GlassProps) {
  return (
    <View style={[{ borderRadius: radius }, elevated && Shadow.soft, style, ANDROID_FLAT]} {...rest}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]} pointerEvents="none">
        {/* Android's blur view ignores the rounded clip and draws an inset box, so Android uses the frosted fill only. */}
        {Platform.OS !== 'android' && <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: strong ? Colors.glassFillStrong : Colors.glassFill },
          ]}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: Colors.glassBorder,
            },
          ]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radius, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassHairline },
          ]}
        />
      </View>
      {children}
    </View>
  );
}
