import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  style?: StyleProp<ViewStyle>;
  /** Fill under the sweep. Pass 'transparent' to use it as an overlay on top of other content. */
  base?: string;
  highlight?: string;
  duration?: number;
};

/** A soft light band sweeping across — skeleton placeholder, or a subtle "working" overlay on chips. */
export function Shimmer({
  style,
  base = 'rgba(60,60,67,0.08)',
  highlight = 'rgba(255,255,255,0.85)',
  duration = 1400,
}: Props) {
  const [width, setWidth] = useState(0);
  const t = useSharedValue(0);

  useEffect(() => {
    if (width === 0) return;
    t.set(0);
    t.set(withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), -1, false));
    return () => cancelAnimation(t);
  }, [width, duration, t]);

  const band = Math.max(60, width * 0.6);
  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: -band + t.get() * (width + band) }],
  }));

  return (
    <View
      style={[styles.base, { backgroundColor: base }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      pointerEvents="none">
      {width > 0 && (
        <Animated.View style={[styles.band, { width: band }, sweep]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', highlight, 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
});
