import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';

import { initApp } from '@controllers/bootstrap.controller';
import { useSettingsStore } from '@stores/settings.store';

/**
 * App lifecycle hook — call once in the root layout. Runs migrations + seeds
 * defaults, exposing readiness so the splash screen stays up until the data
 * layer is ready. Foreground refresh / rates sync are wired in later stages.
 */
export function useAppBootstrap(): { ready: boolean; error: Error | null } {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    initApp()
      .catch((e: unknown) => {
        // Never leave the app on a blank screen: log, surface the error, but
        // still mark ready so the UI renders (empty is better than white).
        console.warn('[bootstrap] init failed', e);
        if (mounted) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // In 'system' theme, follow the OS appearance changes.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      const { theme } = useSettingsStore.getState();
      if (theme === 'system' && colorScheme) {
        useSettingsStore.setState({ resolvedScheme: colorScheme });
      }
    });
    return () => sub.remove();
  }, []);

  return { ready, error };
}
