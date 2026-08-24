import { useEffect } from 'react';
import * as Linking from 'expo-linking';

import type { InputPrefill } from '@components/inputSheetRef';
import { openInputSheet } from '@components/inputSheetRef';
import { parseAddDeepLink } from '@utils/deepLink';

/**
 * Opens the input sheet when the app is launched or foregrounded via a
 * `centry://add` deep link (docs/UX_SPEC.md#ядро-ввода). One handler for three
 * entry points: the widget tap, the evening reminder, and the Siri App Intent —
 * the Siri intent (iOS 17+) carries the parsed phrase as query params
 * (`?kind=expense&amount=12&note=…`), so the sheet opens pre-seeded. Handles both
 * a cold start (initial URL) and a warm tap (url event). Mounted once at the app
 * root alongside the sheet.
 */
export function useWidgetDeepLink(): void {
  useEffect(() => {
    let cancelled = false;

    const handle = (url: string | null): void => {
      if (!url || cancelled) return;
      const parsed = parseAddDeepLink(Linking.parse(url));
      if (!parsed.isAdd) return;
      const prefill: InputPrefill = {};
      if (parsed.kind) prefill.kind = parsed.kind;
      if (parsed.amount) prefill.amount = parsed.amount;
      if (parsed.note) prefill.note = parsed.note;
      openInputSheet(prefill.kind || prefill.amount || prefill.note ? prefill : undefined);
    };

    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
