import type { Id, Transaction, TransactionKind } from '@models';

import { localDay } from './money';
import { uuid } from './uuid';

/**
 * Input to build a single (non-transfer) transaction. Amount is the positive
 * magnitude in minor units; the sign is derived from `kind`.
 */
export interface TransactionDraft {
  accountId: Id;
  currency: string;
  kind: Exclude<TransactionKind, 'transfer'>;
  amountMinorAbs: number;
  categoryId: Id | null;
  note: string | null;
  occurredAtSec: number;
}

/**
 * Pure factory for a transaction record — the single place that applies the
 * sign convention (expense negative, income positive), freezes the rate
 * (rule 2) and stamps `local_day` (rule 8). No DB access, so it is unit-tested
 * directly. The controller wraps this with the repo write + store refresh.
 */
export function buildTransaction(
  draft: TransactionDraft,
  rateToBaseE6: number,
  nowSec: number,
  tzOffsetMin: number,
): Transaction {
  const magnitude = Math.abs(draft.amountMinorAbs);
  const amountMinor = draft.kind === 'expense' ? -magnitude : magnitude;

  return {
    id: uuid(),
    accountId: draft.accountId,
    categoryId: draft.categoryId,
    kind: draft.kind,
    amountMinor,
    currency: draft.currency,
    rateToBaseE6,
    note: draft.note,
    occurredAt: draft.occurredAtSec,
    localDay: localDay(draft.occurredAtSec, tzOffsetMin),
    transferPairId: null,
    authorId: 'me',
    createdAt: nowSec,
    updatedAt: nowSec,
    deletedAt: null,
  };
}

/** A cross-account transfer (B12): source magnitude out, destination magnitude in. */
export interface TransferDraft {
  fromAccountId: Id;
  fromCurrency: string;
  fromAmountMinorAbs: number;
  toAccountId: Id;
  toCurrency: string;
  toAmountMinorAbs: number;
  note: string | null;
  occurredAtSec: number;
}

/**
 * Pure factory for a transfer's two linked rows (`transfer_pair_id`). No
 * commission; each leg freezes its own rate to base (rule 2). The user may set
 * any destination amount — we never impose a "correct" cross rate (B12).
 */
export function buildTransferPair(
  draft: TransferDraft,
  fromRateToBaseE6: number,
  toRateToBaseE6: number,
  nowSec: number,
  tzOffsetMin: number,
): [Transaction, Transaction] {
  const pairId = uuid();
  const day = localDay(draft.occurredAtSec, tzOffsetMin);
  const common = {
    kind: 'transfer' as const,
    categoryId: null,
    note: draft.note,
    occurredAt: draft.occurredAtSec,
    localDay: day,
    transferPairId: pairId,
    authorId: 'me',
    createdAt: nowSec,
    updatedAt: nowSec,
    deletedAt: null,
  };
  const from: Transaction = {
    ...common,
    id: uuid(),
    accountId: draft.fromAccountId,
    amountMinor: -Math.abs(draft.fromAmountMinorAbs),
    currency: draft.fromCurrency,
    rateToBaseE6: fromRateToBaseE6,
  };
  const to: Transaction = {
    ...common,
    id: uuid(),
    accountId: draft.toAccountId,
    amountMinor: Math.abs(draft.toAmountMinorAbs),
    currency: draft.toCurrency,
    rateToBaseE6: toRateToBaseE6,
  };
  return [from, to];
}
