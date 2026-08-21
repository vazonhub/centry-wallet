import { useEffect } from 'react';
import * as Linking from 'expo-linking';

import { openInputSheet } from '@components/inputSheetRef';

/** The deep link the widget opens on tap (targets/widget/*.swift → widgetURL). */
const ADD_HOSTS = new Set(['add', 'input']);

function isAddLink(url: string): boolean {
  const { hostname, path } = Linking.parse(url);
  return ADD_HOSTS.has(hostname ?? '') || ADD_HOSTS.has((path ?? '').replace(/^\/+/, ''));
}

/**
 * Opens the input sheet when the app is launched or foregrounded via the
 * `centry://add` widget deep link (docs/UX_SPEC.md#ядро-ввода). Handles both a
 * cold start (initial URL) and a warm tap (url event). Mounted once at the app
 * root alongside the sheet.
 */
export function useWidgetDeepLink(): void {
  useEffect(() => {
    let cancelled = false;

    const handle = (url: string | null): void => {
      if (!url || cancelled) return;
      if (isAddLink(url)) openInputSheet();
    };

    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
