import { DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';
import { RecordingsProvider } from '@/store/recordings';
import { SettingsProvider } from '@/store/settings';
import { OrphanRecovery } from '@/stt/orphan-recovery';
import { TranscriptionWorker } from '@/stt/transcription-worker';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: Colors.background, primary: Colors.tint },
};

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={theme}>
        <SettingsProvider>
          <RecordingsProvider>
            <TranscriptionWorker />
            <OrphanRecovery />
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
              <Stack.Screen name="(tabs)" />
              {/* Native push. 'ios_from_right' gives Android the iOS-style slide with parallax that matches the
                  app's look; on iOS it resolves to the default native push (and its swipe-back gesture). */}
              <Stack.Screen name="recording/[id]" options={{ animation: 'ios_from_right' }} />
            </Stack>
          </RecordingsProvider>
        </SettingsProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
