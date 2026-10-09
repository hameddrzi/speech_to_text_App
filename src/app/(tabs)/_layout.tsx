import { Tabs } from 'expo-router/js-tabs';
import { Easing } from 'react-native';

import { GlassTabBar } from '@/components/glass-tab-bar';
import { Duration } from '@/constants/motion';
import { Colors } from '@/constants/theme';

/**
 * Tabs cross-fade briefly instead of cutting. It's an opacity-only, non-blocking transition (the new tab is
 * interactive immediately), so it is kept with reduced motion too.
 */
const TAB_TRANSITION = {
  animation: 'timing',
  config: { duration: Duration.tabFade, easing: Easing.out(Easing.cubic) },
} as const;

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: Colors.background },
        animation: 'fade',
        transitionSpec: TAB_TRANSITION,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Record' }} />
      <Tabs.Screen name="archive" options={{ title: 'Archive' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
