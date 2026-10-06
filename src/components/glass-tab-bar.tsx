import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/glass';
import { Colors, Radius, Shadow, Spacing, TabBarBottomGap, TabBarHeight } from '@/constants/theme';
import { haptic } from '@/utils/haptics';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  index: { label: 'Record', icon: 'mic-outline', iconActive: 'mic' },
  archive: { label: 'Archive', icon: 'albums-outline', iconActive: 'albums' },
  profile: { label: 'Profile', icon: 'person-circle-outline', iconActive: 'person-circle' },
};

const BAR_WIDTH = 300;
const INNER_PADDING = 6;

/** Floating frosted-glass pill tab bar with a sliding white "lens" behind the active tab. */
export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const count = state.routes.length;
  const itemWidth = (BAR_WIDTH - INNER_PADDING * 2) / count;
  const x = useSharedValue(state.index * itemWidth);

  useEffect(() => {
    x.value = withSpring(state.index * itemWidth, { damping: 18, stiffness: 180, mass: 0.8 });
  }, [state.index, itemWidth, x]);

  const lensStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { bottom: Math.max(insets.bottom, TabBarBottomGap) }]}>
      <Glass radius={Radius.pill} intensity={60} style={styles.bar}>
        <Animated.View style={[styles.lens, { width: itemWidth }, lensStyle]} />
        {state.routes.map((route, index) => {
          const meta = TABS[route.name];
          if (!meta) return null;
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptic.selection();
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
              onPress={onPress}
              style={[styles.item, { width: itemWidth }]}>
              <Ionicons
                name={focused ? meta.iconActive : meta.icon}
                size={22}
                color={focused ? (route.name === 'index' ? Colors.record : Colors.label) : Colors.labelSecondary}
              />
              <Animated.Text
                style={[styles.label, { color: focused ? Colors.label : Colors.labelSecondary }]}>
                {meta.label}
              </Animated.Text>
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    width: BAR_WIDTH,
    height: TabBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: INNER_PADDING,
    ...Shadow.lifted,
  },
  lens: {
    position: 'absolute',
    left: INNER_PADDING,
    top: INNER_PADDING,
    bottom: INNER_PADDING,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassHairline,
    ...Shadow.soft,
    shadowOpacity: 0.06,
  },
  item: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxs,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
