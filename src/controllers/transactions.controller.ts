import { ACCOUNT_KIND_ICONS, GOAL_ICON } from '@constants/icons';
import { AccountsRepo, TransactionsRepo } from '@db';
import type { Account, Id, SpendAccountKind } from '@models';
import { getRateForNewTransaction } from '@services/rates';
import { useSettingsStore } from '@stores/settings.store';
import { currentTzOffsetMin, nowSec } from '@utils/date';
import {
  applyCrossRate,
  convertFromBase,
  convertToBase,
  deriveRateToBaseE6,
  localDay,
} from '@utils/money';
import { buildTransaction, buildTransferPair, type TransactionDraft } from '@utils/transaction';
import { uuid } from '@utils/uuid';

import { DataController } from './data.controller';

export interface AddTransactionInput {
  accountId: Id;
  currency: string;
  kind: TransactionDraft['kind'];
  amountMinorAbs: number;
  categoryId: Id | null;
  note: string | null;
  occurredAtSec?: number;
}

/**
 * The single funnel every entry point uses to record a transaction (the TS
 * side of the one `AddTransactionIntent`, docs/UX_SPEC.md#ядро-ввода): freeze
 * the rate, build the record, persist, remember the account, refresh the store.
 */
async function addTransaction(input: AddTransactionInput): Promise<void> {
  const base = useSettingsStore.getState().baseCurrency;
  const rateToBaseE6 = await getRateForNewTransaction(input.currency, base);

  const draft: TransactionDraft = {
    accountId: input.accountId,
    currency: input.currency,
    kind: input.kind,
    amountMinorAbs: input.amountMinorAbs,
    categoryId: input.categoryId,
    note: input.note,
    occurredAtSec: input.occurredAtSec ?? nowSec(),
  };

  const tx = buildTransaction(draft, rateToBaseE6, nowSec(), currentTzOffsetMin());
  await TransactionsRepo.createTransaction(tx);
  useSettingsStore.getState().setLastAccountId(input.accountId);

  await DataController.loadAll(); // also refreshes the widget snapshot (etap 7)
}

export interface CreateAccountInput {
  name: string;
  currency: string;
  kind: SpendAccountKind;
  icon?: string | null;
  openingMinor?: number;
  makeDefault?: boolean;
}

/** Creates an account (used by settings and by the on-the-fly flow, D7). */
async function createAccount(input: CreateAccountInput): Promise<Account> {
  const now = nowSec();
  const existing = await AccountsRepo.listAccounts(true);
  const account: Account = {
    id: uuid(),
    name: input.name,
    currency: input.currency,
    kind: input.kind,
    icon: input.icon ?? ACCOUNT_KIND_ICONS[input.kind],
    openingMinor: input.openingMinor ?? 0,
    sortOrder: existing.length,
    isDefault: input.makeDefault ?? existing.length === 0,
    targetMinor: null,
    color: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  await AccountsRepo.createAccount(account);
  if (account.isDefault) await AccountsRepo.setDefaultAccount(account.id, now);
  await DataController.loadAll();
  return account;
}

export interface CreateGoalInput {
  name: string;
  currency: string;
  targetMinor: number;
  color: string | null;
  icon?: string | null;
}

/**
 * Creates a savings goal — a special account (kind 'goal'). It is excluded from
 * the daily allowance and spend statistics by construction; money reaches it via
 * a transfer (see {@link topUpGoal}). Never becomes the default account.
 */
async function createGoal(input: CreateGoalInput): Promise<Account> {
  const now = nowSec();
  const existing = await AccountsRepo.listAccounts(true);
  const goal: Account = {
    id: uuid(),
    name: input.name,
    currency: input.currency,
    kind: 'goal',
    icon: input.icon ?? GOAL_ICON,
    openingMinor: 0,
    sortOrder: existing.length,
    isDefault: false,
    targetMinor: input.targetMinor,
    color: input.color,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  await AccountsRepo.createAccount(goal);
  await DataController.loadAll();
  return goal;
}

export interface UpdateGoalInput {
  name: string;
  targetMinor: number;
  color: string | null;
  icon?: string | null;
}

/** Edits a goal's name / target / colour. */
async function updateGoal(id: Id, input: UpdateGoalInput): Promise<void> {
  await AccountsRepo.updateGoal(
    id,
    {
      name: input.name,
      targetMinor: input.targetMinor,
      color: input.color,
      icon: input.icon ?? GOAL_ICON,
    },
    nowSec(),
  );
  await DataController.loadAll();
}

/**
 * Moves money onto a goal from a spend account — a plain transfer, so it never
 * counts as spending. `amountMinorAbs` is in the source account's currency; the
 * destination amount is converted at the frozen market rate (goals cross-currency
 * like any transfer).
 */
async function topUpGoal(goalId: Id, fromAccountId: Id, amountMinorAbs: number): Promise<void> {
  const [goal, from] = await Promise.all([
    AccountsRepo.getAccount(goalId),
    AccountsRepo.getAccount(fromAccountId),
  ]);
  if (!goal || !from || amountMinorAbs <= 0) return;
  const base = useSettingsStore.getState().baseCurrency;
  const [fromRate, toRate] = await Promise.all([
    getRateForNewTransaction(from.currency, base),
    getRateForNewTransaction(goal.currency, base),
  ]);
  // Convert the source amount into the goal's currency at the market rate — the
  // same base round-trip the transfer sheet uses for its default amount.
  const toAmountMinorAbs =
    from.currency === goal.currency
      ? amountMinorAbs
      : convertFromBase(convertToBase(amountMinorAbs, fromRate), toRate);
  await addTransfer({
    fromAccountId,
    fromCurrency: from.currency,
    fromAmountMinorAbs: amountMinorAbs,
    toAccountId: goalId,
    toCurrency: goal.currency,
    toAmountMinorAbs,
    note: null,
  });
}

/**
 * Closes a goal — the saved money "burns" (we bought the thing). The goal is
 * archived so its balance leaves the wallet total (net worth drops by the saved
 * amount), and `closed_at` marks it completed. No expense is recorded, so it
 * never counts as a daily spend or pollutes statistics (owner spec).
 */
async function closeGoal(id: Id): Promise<void> {
  await AccountsRepo.closeGoal(id, nowSec());
  await DataController.loadAll();
}

export interface UpdateAccountInput {
  name: string;
  kind: SpendAccountKind;
  /** Starting balance in the account's own currency (minor units). */
  openingMinor: number;
}

/**
 * Switches an account to a new currency at the given from→to rate (×1e6). Every
 * transaction on the account and its opening balance are converted to the new
 * currency; each transaction's base value is preserved (its rate_to_base is
 * re-derived) so History/stats totals don't move. Rewrites frozen rates
 * (rule 2) — a deliberate, warned action. No-op if the currency is unchanged.
 */
async function changeAccountCurrency(id: Id, newCurrency: string, rateE6: number): Promise<void> {
  const account = await AccountsRepo.getAccount(id);
  if (!account || account.currency === newCurrency || rateE6 <= 0) return;
  const oldCurrency = account.currency;

  const txs = await TransactionsRepo.listTransactionsForAccount(id);
  const newOpeningMinor = applyCrossRate(account.openingMinor, oldCurrency, rateE6, newCurrency);
  const txUpdates = txs.map((t) => {
    const amountMinor = applyCrossRate(t.amountMinor, oldCurrency, rateE6, newCurrency);
    // Keep the base-currency value identical: re-derive the rate for the new amount.
    const baseMinor = convertToBase(t.amountMinor, t.rateToBaseE6);
    return { id: t.id, amountMinor, rateToBaseE6: deriveRateToBaseE6(amountMinor, baseMinor) };
  });

  await TransactionsRepo.convertAccountCurrency(
    id,
    newCurrency,
    newOpeningMinor,
    txUpdates,
    nowSec(),
  );
  await DataController.loadAll();
}

/** Edits an account's name / kind / opening balance (currency is fixed — see repo). */
async function updateAccount(id: Id, input: UpdateAccountInput): Promise<void> {
  await AccountsRepo.updateAccount(
    id,
    {
      name: input.name,
      kind: input.kind,
      icon: ACCOUNT_KIND_ICONS[input.kind],
      openingMinor: input.openingMinor,
    },
    nowSec(),
  );
  await DataController.loadAll();
}

/**
 * Deletes an account by archiving it (soft delete via `archived_at`, rule 10) —
 * it drops out of the wallet, chips and filters, but its transactions stay in
 * history untouched (rule 2: frozen rates/amounts are never rewritten). Refuses
 * to remove the last active account, and promotes another account to default if
 * the archived one was the default.
 */
async function deleteAccount(id: Id): Promise<void> {
  const active = await AccountsRepo.listAccounts(false);
  if (active.length <= 1) {
    throw new Error('Cannot delete your only account — create another one first.');
  }
  const now = nowSec();
  const target = active.find((a) => a.id === id);
  await AccountsRepo.archiveAccount(id, now);
  if (target?.isDefault) {
    const next = active.find((a) => a.id !== id);
    if (next) await AccountsRepo.setDefaultAccount(next.id, now);
  }
  if (useSettingsStore.getState().lastAccountId === id) {
    useSettingsStore.getState().setLastAccountId(null);
  }
  await DataController.loadAll();
}

/**
 * Persists a user-defined account order (drag-and-drop on Home / Settings). Only
 * the visible active accounts are passed; `sort_order` is rewritten to match,
 * then the store + widget snapshot refresh through the single funnel.
 */
async function reorderAccounts(orderedIds: Id[]): Promise<void> {
  await AccountsRepo.reorderAccounts(orderedIds, nowSec());
  await DataController.loadAll();
}

export interface AddTransferInput {
  fromAccountId: Id;
  fromCurrency: string;
  fromAmountMinorAbs: number;
  toAccountId: Id;
  toCurrency: string;
  toAmountMinorAbs: number;
  note: string | null;
  occurredAtSec?: number;
}

/** Records a cross-account transfer as two linked rows (B12). No commission. */
async function addTransfer(input: AddTransferInput): Promise<void> {
  const base = useSettingsStore.getState().baseCurrency;
  const [fromRate, toRate] = await Promise.all([
    getRateForNewTransaction(input.fromCurrency, base),
    getRateForNewTransaction(input.toCurrency, base),
  ]);

  const [from, to] = buildTransferPair(
    {
      fromAccountId: input.fromAccountId,
      fromCurrency: input.fromCurrency,
      fromAmountMinorAbs: input.fromAmountMinorAbs,
      toAccountId: input.toAccountId,
      toCurrency: input.toCurrency,
      toAmountMinorAbs: input.toAmountMinorAbs,
      note: input.note,
      occurredAtSec: input.occurredAtSec ?? nowSec(),
    },
    fromRate,
    toRate,
    nowSec(),
    currentTzOffsetMin(),
  );

  await TransactionsRepo.createTransaction(from);
  await TransactionsRepo.createTransaction(to);
  useSettingsStore.getState().setLastAccountId(input.fromAccountId);
  await DataController.loadAll();
}

/** Edits a transaction's category/note. For transfers the note syncs both legs. */
async function editTransactionMeta(
  id: Id,
  fields: { categoryId?: Id | null; note?: string | null },
): Promise<void> {
  const now = nowSec();
  const tx = await TransactionsRepo.getTransaction(id);
  if (tx?.transferPairId && 'note' in fields) {
    // Transfers have no category; only the shared note applies, to both legs.
    await TransactionsRepo.updateTransferNote(tx.transferPairId, fields.note ?? null, now);
  } else {
    await TransactionsRepo.updateTransactionMeta(id, fields, now);
  }
  await DataController.loadAll();
}

/**
 * Edits a cross-account transfer's amounts (B12): the source magnitude out of the
 * from-account and the destination magnitude into the to-account. Both legs are
 * updated together so neither account's balance is left skewed; the from→to rate
 * is implied by the two amounts (no separate rate column). Frozen base rates are
 * currency→base and amount-independent, so they are untouched (rule 2).
 */
async function editTransfer(
  pairId: Id,
  amounts: { fromMinorAbs: number; toMinorAbs: number },
): Promise<void> {
  const legs = await TransactionsRepo.listTransferLegs(pairId);
  const fromLeg = legs.find((l) => l.amountMinor < 0);
  const toLeg = legs.find((l) => l.amountMinor > 0);
  if (!fromLeg || !toLeg) return;
  if (amounts.fromMinorAbs <= 0 || amounts.toMinorAbs <= 0) return;
  const now = nowSec();
  await TransactionsRepo.updateTransactionAmount(fromLeg.id, -Math.abs(amounts.fromMinorAbs), now);
  await TransactionsRepo.updateTransactionAmount(toLeg.id, Math.abs(amounts.toMinorAbs), now);
  await DataController.loadAll();
}

/**
 * Corrects a transaction's amount. `amountMinorAbs` is the non-negative
 * magnitude; the sign is applied from `kind` (expense → negative, income →
 * positive). Not for transfers.
 */
async function editTransactionAmount(
  id: Id,
  amountMinorAbs: number,
  kind: 'expense' | 'income',
): Promise<void> {
  const signed = kind === 'income' ? amountMinorAbs : -amountMinorAbs;
  await TransactionsRepo.updateTransactionAmount(id, signed, nowSec());
  await DataController.loadAll();
}

/**
 * Moves a transaction to another account. Only same-currency moves are allowed
 * (the target must match the transaction's currency, since account balances sum
 * amounts without conversion). Not for transfers — their two legs are bound to
 * specific accounts. Throws on a currency mismatch.
 */
async function editTransactionAccount(id: Id, accountId: Id): Promise<void> {
  const tx = await TransactionsRepo.getTransaction(id);
  if (!tx || tx.transferPairId) return;
  const account = await AccountsRepo.getAccount(accountId);
  if (!account) return;
  if (account.currency !== tx.currency) {
    throw new Error('Cannot move a transaction to an account in a different currency.');
  }
  await TransactionsRepo.updateTransactionAccount(id, accountId, nowSec());
  await DataController.loadAll();
}

/**
 * Reassigns one leg of a transfer to another account of the SAME currency (the
 * leg's amount is in that currency; a different currency would corrupt balances).
 * The two legs must stay on different accounts. Throws on a currency mismatch.
 */
async function editTransferAccount(pairId: Id, side: 'from' | 'to', accountId: Id): Promise<void> {
  const legs = await TransactionsRepo.listTransferLegs(pairId);
  const fromLeg = legs.find((l) => l.amountMinor < 0);
  const toLeg = legs.find((l) => l.amountMinor > 0);
  const leg = side === 'from' ? fromLeg : toLeg;
  const other = side === 'from' ? toLeg : fromLeg;
  if (!leg || !other) return;
  if (accountId === other.accountId || accountId === leg.accountId) return;
  const account = await AccountsRepo.getAccount(accountId);
  if (!account) return;
  if (account.currency !== leg.currency) {
    throw new Error('Cannot move a transfer leg to an account in a different currency.');
  }
  await TransactionsRepo.updateTransactionAccount(leg.id, accountId, nowSec());
  await DataController.loadAll();
}

/** Moves a transaction to another date (recomputes its local_day, rule 8). For
 * transfers both legs move together so they stay grouped on the same day. */
async function editTransactionDate(id: Id, occurredAtSec: number): Promise<void> {
  const day = localDay(occurredAtSec, currentTzOffsetMin());
  const now = nowSec();
  const tx = await TransactionsRepo.getTransaction(id);
  if (tx?.transferPairId) {
    await TransactionsRepo.updateTransferDate(tx.transferPairId, occurredAtSec, day, now);
  } else {
    await TransactionsRepo.updateTransactionDate(id, occurredAtSec, day, now);
  }
  await DataController.loadAll();
}

async function deleteTransaction(id: Id): Promise<void> {
  const tx = await TransactionsRepo.getTransaction(id);
  const now = nowSec();
  // A transfer is two linked rows shown as one — delete both legs so the other
  // account's balance doesn't keep a dangling half.
  if (tx?.transferPairId) {
    await TransactionsRepo.softDeleteTransferPair(tx.transferPairId, now);
  } else {
    await TransactionsRepo.softDeleteTransaction(id, now);
  }
  await DataController.loadAll();
}

export const TransactionsController = {
  addTransaction,
  addTransfer,
  createAccount,
  createGoal,
  updateGoal,
  topUpGoal,
  closeGoal,
  updateAccount,
  changeAccountCurrency,
  deleteAccount,
  reorderAccounts,
  editTransactionMeta,
  editTransactionAmount,
  editTransactionAccount,
  editTransfer,
  editTransferAccount,
  editTransactionDate,
  deleteTransaction,
};
