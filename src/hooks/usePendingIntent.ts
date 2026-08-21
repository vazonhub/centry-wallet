import { useEffect } from 'react';
import { AppState } from 'react-native';

import { openInputSheet } from '@components/inputSheetRef';
import { consumePendingIntent } from '@services/intents';

/**
 * Opens the input sheet, pre-seeded, when a Siri App Intent left a pending
 * prefill (etap 8). Checks on a cold start (the intent launched the app) and
 * whenever the app returns to the foreground (the intent ran while backgrounded).
 * Mounted once at the app root alongside the widget/notification hooks.
 */
export function usePendingIntent(): void {
  useEffect(() => {
    const check = (): void => {
      const prefill = consumePendingIntent();
      if (prefill) openInputSheet(prefill);
    };

    // Defer the cold-start check one tick so the input sheet ref is mounted.
    const id = setTimeout(check, 0);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearTimeout(id);
      sub.remove();
    };
  }, []);
}
