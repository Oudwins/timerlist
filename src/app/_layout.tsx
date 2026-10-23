import '../global.css';

import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    DMSans: require('../../assets/fonts/DMSans.ttf'),
    DMSansMedium: require('../../assets/fonts/DMSans.ttf'),
    DMMono: require('../../assets/fonts/DMMono.ttf'),
  });
  useEffect(() => { if (loaded || error) SplashScreen.hide(); }, [loaded, error]);
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider value={DarkTheme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#28211D' } }} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
