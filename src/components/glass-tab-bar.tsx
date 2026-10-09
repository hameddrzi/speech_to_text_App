import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/glass';
import { PressScale, Spring, Timing } from '@/constants/motion';
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
const ICON_SIZE = 22;

/**
 * One tab: the outline and filled glyphs are stacked and cross-fade (with their colors) as the tab becomes
 * active, the label color follows through interpolateColor, and the icon dips slightly while pressed.
 */
function TabItem({
  meta,
  focused,
  activeColor,
  width,
  onPress,
}: {
  meta: { label: string; icon: IconName; iconActive: IconName };
  focused: boolean;
  activeColor: string;
  width: number;
  onPress: () => void;
}) {
  const on = useSharedValue(focused ? 1 : 0);
  const pressed = useSharedValue(1);

  useEffect(() => {
    on.set(withTiming(focused ? 1 : 0, Timing.fade));
  }, [focused, on]);

  const iconWrapStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressed.get() }] }));
  const outlineStyle = useAnimatedStyle(() => ({ opacity: 1 - on.get() }));
  const filledStyle = useAnimatedStyle(() => ({ opacity: on.get() }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(on.get(), [0, 1], [Colors.labelSecondary, Colors.label]),
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={meta.label}
      onPress={onPress}
      onPressIn={() => {
        pressed.set(withTiming(PressScale.control, Timing.pressIn));
      }}
      onPressOut={() => {
        pressed.set(withSpring(1, Spring.press));
      }}
      style={[styles.item, { width }]}>
      <Animated.View style={[styles.icon, iconWrapStyle]}>
        <Animated.View style={[styles.iconLayer, outlineStyle]}>
          <Ionicons name={meta.icon} size={ICON_SIZE} color={Colors.labelSecondary} />
        </Animated.View>
        <Animated.View style={[styles.iconLayer, filledStyle]}>
          <Ionicons name={meta.iconActive} size={ICON_SIZE} color={activeColor} />
        </Animated.View>
      </Animated.View>
      <Animated.Text style={[styles.label, labelStyle]}>{meta.label}</Animated.Text>
    </Pressable>
  );
}

/** Floating frosted-glass pill tab bar with a sliding white "lens" behind the active tab. */
export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const count = state.routes.length;
  const itemWidth = (BAR_WIDTH - INNER_PADDING * 2) / count;
  const x = useSharedValue(state.index * itemWidth);

  // Well-damped spring: the lens glides under the new tab and lands without a wobble.
  useEffect(() => {
    x.set(withSpring(state.index * itemWidth, Spring.control));
  }, [state.index, itemWidth, x]);

  const lensStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

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
            <TabItem
              key={route.key}
              meta={meta}
              focused={focused}
              activeColor={route.name === 'index' ? Colors.record : Colors.label}
              width={itemWidth}
              onPress={onPress}
            />
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
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  iconLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
