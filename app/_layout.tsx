import 'react-native-gesture-handler';

import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import '@i18n';

import { useAppBootstrap } from '@hooks/useAppBootstrap';
import { useNotificationResponse } from '@hooks/useNotificationResponse';
import { useIsDark, usePalette } from '@hooks/usePalette';
import { useQuickAddDrain } from '@hooks/useQuickAddDrain';
import { useSiriPrefill } from '@hooks/useSiriPrefill';
import { useWidgetDeepLink } from '@hooks/useWidgetDeepLink';
import { AccountSheet } from '@components/AccountSheet';
import { BudgetSheet } from '@components/BudgetSheet';
import { CategoryEditorSheet } from '@components/CategoryEditorSheet';
import { GoalsSheet } from '@components/GoalsSheet';
import { TransactionDetailSheet } from '@components/TransactionDetailSheet';
import { WalletTotalSheet } from '@components/WalletTotalSheet';
import { InputSheet } from '@views/input/InputSheet';
import { OnboardingScreen } from '@views/onboarding/OnboardingScreen';

void SplashScreen.preventAutoHideAsync();

// Anchor the root stack to the `(tabs)` group so a cold start / dev-client
// launch URL deterministically resolves to the tabs instead of an empty route.
export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  // Gate the app tree on bootstrap readiness. `ready` is ALWAYS set — even if
  // bootstrap throws (see useAppBootstrap's `finally`) — so this can never leave
  // a permanent blank screen; it only holds the native splash for the few ms of
  // local SQLite load. Mounting the screens only after the data store is
  // populated makes them read accounts/categories on their FIRST render, fixing
  // the bug where the initial async setSnapshot landed in the mount→subscribe
  // race window and data stayed empty until an unrelated interaction (opening a
  // picker/modal) forced a re-commit.
  const { ready } = useAppBootstrap();
  useWidgetDeepLink();
  useSiriPrefill();
  useQuickAddDrain();
  useNotificationResponse();
  const isDark = useIsDark();
  const palette = usePalette();

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  return (
    // The root is painted with the theme canvas so no white flashes through
    // during native navigation when the system scheme differs from the app's
    // (light system + dark app). Mirrors the Bsuir Time root-background fix.
    <GestureHandlerRootView style={[styles.root, { backgroundColor: palette.canvasBase }]}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <BottomSheetModalProvider>
          {ready && (
            <>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
              </Stack>
              <InputSheet />
              <AccountSheet />
              <BudgetSheet />
              <CategoryEditorSheet />
              <GoalsSheet />
              <TransactionDetailSheet />
              <WalletTotalSheet />
              <OnboardingScreen />
            </>
          )}
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
