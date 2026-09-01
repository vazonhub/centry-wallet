import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { InputPrefill } from '@components/inputSheetRef';
import { openInputSheet } from '@components/inputSheetRef';
import { consumePendingAdd } from '@services/appGroup';
import { useSettingsStore } from '@stores/settings.store';

/**
 * Opens the input sheet when a Siri "Add expense/income" App Intent ran. The
 * intent can't open a `centry://` URL (iOS forbids custom schemes in
 * OpenURLIntent), so it foregrounds the app (`openAppWhenRun`) and leaves the
 * parsed phrase in the App-Group store; this hook picks it up on launch and on
 * every foreground. Mounted once at the app root.
 *
 * The "Добавлять голосом" setting (`inputSiri`) gates the seed — we still open
 * the sheet (Siri asked to add), but ignore the amount/note when the toggle is
 * off, mirroring {@link useWidgetDeepLink}.
 */
export function useSiriPrefill(): void {
  useEffect(() => {
    const apply = (): void => {
      const pending = consumePendingAdd();
      if (!pending) return;
      const prefill: InputPrefill = {};
      if (pending.kind) prefill.kind = pending.kind;
      if (pending.amount) prefill.amount = pending.amount;
      if (pending.note) prefill.note = pending.note;
      if (pending.accountId) prefill.accountId = pending.accountId;
      const hasPrefill = Boolean(
        prefill.kind || prefill.amount || prefill.note || prefill.accountId,
      );
      const siriEnabled = useSettingsStore.getState().inputSiri;
      openInputSheet(hasPrefill && siriEnabled ? prefill : undefined);
    };

    apply(); // cold start
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') apply();
    });
    return () => sub.remove();
  }, []);
}
