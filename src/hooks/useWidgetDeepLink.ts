import { useEffect } from 'react';
import * as Linking from 'expo-linking';

import type { InputPrefill } from '@components/inputSheetRef';
import { openInputSheet } from '@components/inputSheetRef';
import { useSettingsStore } from '@stores/settings.store';
import { parseAddDeepLink } from '@utils/deepLink';

/**
 * Opens the input sheet when the app is launched or foregrounded via a
 * `centry://add` deep link (docs/UX_SPEC.md#ядро-ввода). One handler for three
 * entry points: the widget tap, the evening reminder, and the Siri App Intent —
 * the Siri intent (iOS 18+) carries the parsed phrase as query params
 * (`?kind=expense&amount=12&note=…`), so the sheet opens pre-seeded. Handles both
 * a cold start (initial URL) and a warm tap (url event). Mounted once at the app
 * root alongside the sheet.
 *
 * The "Добавлять голосом" setting (`inputSiri`) gates the prefill: a link that
 * carries params only comes from Siri (the widget/reminder use a bare
 * `centry://add`), so when the toggle is off we still open the sheet but ignore
 * the seed — a real effect for the toggle without touching native Siri.
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
      const hasPrefill = Boolean(prefill.kind || prefill.amount || prefill.note);
      const siriEnabled = useSettingsStore.getState().inputSiri;
      openInputSheet(hasPrefill && siriEnabled ? prefill : undefined);
    };

    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
