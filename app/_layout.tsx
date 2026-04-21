import { Stack } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Appearance } from 'react-native';

const APP_SHELL_COLOR = '#050505';

void SystemUI.setBackgroundColorAsync(APP_SHELL_COLOR);

export default function RootLayout() {
  useEffect(() => {
    Appearance.setColorScheme('dark');
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
