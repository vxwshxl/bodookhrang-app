import { Stack } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Appearance } from 'react-native';

const APP_SHELL_COLOR = '#ffffff';

void SystemUI.setBackgroundColorAsync(APP_SHELL_COLOR);

export default function RootLayout() {
  useEffect(() => {
    Appearance.setColorScheme('dark');
  }, []);

  return (
    <>
      {/* Android: full screen — the button bar stays hidden and a swipe up from
          the bottom edge reveals it briefly. No-op on iOS. */}
      <NavigationBar hidden style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}
