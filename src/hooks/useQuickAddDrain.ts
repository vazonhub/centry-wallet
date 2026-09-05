import { useEffect } from 'react';
import { AppState } from 'react-native';

import { TransactionsController } from '@controllers/transactions.controller';
import { consumeQuickAddQueue } from '@services/appGroup';
import { selectDefaultAccount, useDataStore } from '@stores/data.store';
import { parseAmountToMinor } from '@utils/money';

/**
 * Applies quick expenses/incomes the interactive widget enqueued while the app
 * was closed. The widget can't safely touch SQLite, so it appends whole-major
 * amounts to an App-Group queue; this hook drains them onto the DEFAULT account
 * (interpreting the amount in that account's currency, uncategorized) as soon as
 * data is loaded — on launch, on every foreground, and once the store finishes
 * loading. Consuming clears the queue, so repeated calls are safe no-ops.
 * Mounted once at the app root.
 */
export function useQuickAddDrain(): void {
  useEffect(() => {
    const drain = async (): Promise<void> => {
      const state = useDataStore.getState();
      if (!state.loaded) return;
      const account = selectDefaultAccount(state);
      if (!account) return;
      const queue = consumeQuickAddQueue();
      for (const q of queue) {
        const amountMinorAbs = parseAmountToMinor(String(q.amountMajor), account.currency);
        if (!amountMinorAbs || amountMinorAbs <= 0) continue;
        await TransactionsController.addTransaction({
          accountId: account.id,
          currency: account.currency,
          kind: q.kind,
          amountMinorAbs,
          categoryId: null,
          note: null,
        });
      }
    };

    void drain(); // cold start (if data already loaded)
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void drain();
    });
    // Cover the cold-start race where the widget was tapped while the app was
    // closed: drain again the moment the store finishes loading.
    const unsub = useDataStore.subscribe((s) => {
      if (s.loaded) void drain();
    });
    return () => {
      sub.remove();
      unsub();
    };
  }, []);
}
