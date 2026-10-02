import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Colors, Spacing } from '@/constants/theme';
import type { Option } from '@/store/settings';

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

const HEIGHT = 32;
const INSET = 2;

/** iOS UISegmentedControl look-alike with a sliding white thumb. */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width > 0 ? (width - INSET * 2) / options.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    x.set(withSpring(index * segment, { damping: 20, stiffness: 220, mass: 0.7 }));
  }, [index, segment, x]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - width) > 0.5) {
      setWidth(w);
      x.set(index * ((w - INSET * 2) / options.length));
    }
  };

  return (
    <View style={styles.track} onLayout={onLayout} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {segment > 0 && <Animated.View style={[styles.thumb, { width: segment }, thumbStyle]} />}
      {options.map((o, i) => {
        const selected = i === index;
        const showDivider = i > 0 && i !== index && i !== index + 1;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={styles.item}>
            {showDivider && <View style={styles.divider} />}
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                selected && styles.labelSelected,
                o.rtl && { writingDirection: 'rtl' },
              ]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    borderRadius: 9,
    padding: INSET,
    flexDirection: 'row',
    backgroundColor: 'rgba(118,118,128,0.12)',
  },
  thumb: {
    position: 'absolute',
    top: INSET,
    left: INSET,
    bottom: INSET,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  divider: {
    position: 'absolute',
    left: 0,
    top: 7,
    bottom: 7,
    width: StyleSheet.hairlineWidth * 2,
    backgroundColor: 'rgba(60,60,67,0.18)',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.08,
    color: Colors.label,
  },
  labelSelected: { fontWeight: '600' },
});
