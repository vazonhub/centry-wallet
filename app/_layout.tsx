import 'react-native-gesture-handler';

import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { useAppBootstrap } from '@hooks/useAppBootstrap';
import { useNotificationResponse } from '@hooks/useNotificationResponse';
import { usePendingIntent } from '@hooks/usePendingIntent';
import { useIsDark } from '@hooks/usePalette';
import { useWidgetDeepLink } from '@hooks/useWidgetDeepLink';
import { CategoryEditorSheet } from '@components/CategoryEditorSheet';
import { TransactionDetailSheet } from '@components/TransactionDetailSheet';
import { InputSheet } from '@views/input/InputSheet';
import { OnboardingScreen } from '@views/onboarding/OnboardingScreen';

void SplashScreen.preventAutoHideAsync();

// Anchor the root stack to the `(tabs)` group so a cold start / dev-client
// launch URL deterministically resolves to the tabs instead of an empty route.
export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  // Bootstrap runs as a background side-effect. We DO NOT gate rendering on it —
  // the UI always renders (empty state until data loads), so a slow/failed
  // bootstrap can never leave a blank screen.
  useAppBootstrap();
  useWidgetDeepLink();
  useNotificationResponse();
  usePendingIntent();
  const isDark = useIsDark();

  useEffect(() => {
    const id = setTimeout(() => void SplashScreen.hideAsync(), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <BottomSheetModalProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
          <InputSheet />
          <CategoryEditorSheet />
          <TransactionDetailSheet />
          <OnboardingScreen />
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
