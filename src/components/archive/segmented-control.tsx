import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic } from '@/utils/haptics';
import { Glass } from '@/components/glass';
import { Spring } from '@/constants/motion';
import { Colors, Radius, Shadow } from '@/constants/theme';

type Props<T extends string> = {
  options: readonly { value: T; label: string; testID?: string }[];
  value: T;
  onChange: (value: T) => void;
};

const PAD = 3;

/** Glass segmented control with a sliding white lens, matching the tab bar. */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const itemWidth = width > 0 ? (width - PAD * 2) / options.length : 0;
  const x = useSharedValue(0);
  const placed = useSharedValue(false);

  useEffect(() => {
    if (itemWidth <= 0) return;
    const to = index * itemWidth;
    // The first measured position is applied directly, so the lens never slides in from the left on mount.
    if (!placed.get()) {
      placed.set(true);
      x.set(to);
      return;
    }
    x.set(withSpring(to, Spring.control));
  }, [index, itemWidth, x, placed]);

  const lensStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <Glass
      radius={Radius.sm}
      elevated={false}
      intensity={30}
      style={styles.track}
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {itemWidth > 0 && <Animated.View style={[styles.lens, { width: itemWidth }, lensStyle]} />}
      <View style={styles.row}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              testID={o.testID}
              style={styles.item}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              onPress={() => {
                if (selected) return;
                haptic.selection();
                onChange(o.value);
              }}>
              <Text style={[styles.label, selected && styles.labelSelected]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 34,
    padding: PAD,
    backgroundColor: 'rgba(118,118,128,0.08)',
  },
  lens: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: Radius.sm - 3,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassHairline,
    ...Shadow.soft,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.08,
    color: Colors.labelSecondary,
  },
  labelSelected: {
    color: Colors.label,
    fontWeight: '600',
  },
});
