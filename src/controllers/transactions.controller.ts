import { ACCOUNT_KIND_ICONS } from '@constants/icons';
import { AccountsRepo, TransactionsRepo } from '@db';
import type { Account, Id } from '@models';
import { getRateForNewTransaction } from '@services/rates';
import { useSettingsStore } from '@stores/settings.store';
import { currentTzOffsetMin, nowSec } from '@utils/date';
import { localDay } from '@utils/money';
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
  kind: Account['kind'];
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
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  await AccountsRepo.createAccount(account);
  if (account.isDefault) await AccountsRepo.setDefaultAccount(account.id, now);
  await DataController.loadAll();
  return account;
}

export interface UpdateAccountInput {
  name: string;
  kind: Account['kind'];
  /** Starting balance in the account's own currency (minor units). */
  openingMinor: number;
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

/** Edits a transaction's category/note (amount edit lands with the full editor). */
async function editTransactionMeta(
  id: Id,
  fields: { categoryId?: Id | null; note?: string | null },
): Promise<void> {
  await TransactionsRepo.updateTransactionMeta(id, fields, nowSec());
  await DataController.loadAll();
}

/** Moves a transaction to another date (recomputes its local_day, rule 8). */
async function editTransactionDate(id: Id, occurredAtSec: number): Promise<void> {
  const day = localDay(occurredAtSec, currentTzOffsetMin());
  await TransactionsRepo.updateTransactionDate(id, occurredAtSec, day, nowSec());
  await DataController.loadAll();
}

async function deleteTransaction(id: Id): Promise<void> {
  await TransactionsRepo.softDeleteTransaction(id, nowSec());
  await DataController.loadAll();
}

export const TransactionsController = {
  addTransaction,
  addTransfer,
  createAccount,
  updateAccount,
  editTransactionMeta,
  editTransactionDate,
  deleteTransaction,
};
