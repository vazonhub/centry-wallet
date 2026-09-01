import { createRef } from 'react';

import type { Transaction } from '@models';

export interface TransactionDetailHandle {
  /** `sibling` is the other leg of a transfer (so the sheet can edit both). */
  open(tx: Transaction, onChanged?: () => void, sibling?: Transaction): void;
}

/**
 * Module-level ref to the single transaction-detail sheet, rendered once at the
 * app root. Opened by tapping a transaction in the History list or the Home
 * feed. `onChanged` lets the opener refresh its own view after an edit/delete
 * (e.g. History reloads the month); the data store is refreshed by the
 * controllers regardless.
 */
export const transactionDetailRef = createRef<TransactionDetailHandle>();

export function openTransactionDetail(
  tx: Transaction,
  onChanged?: () => void,
  sibling?: Transaction,
): void {
  transactionDetailRef.current?.open(tx, onChanged, sibling);
}
