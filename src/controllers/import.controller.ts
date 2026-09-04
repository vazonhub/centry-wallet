import { ACCOUNT_KIND_ICONS } from '@constants/icons';
import { AccountsRepo, CategoriesRepo, TransactionsRepo } from '@db';
import type { Account, Transaction, TransactionKind } from '@models';
import { pickAndReadCsv } from '@services/import';
import { parseTransactionsCsv } from '@utils/csv';
import { currentTzOffsetMin, nowSec } from '@utils/date';
import { displayAccountName, displayCategoryName } from '@utils/displayName';
import { uuid } from '@utils/uuid';

import { en } from '../i18n/en';
import { ru } from '../i18n/ru';
import { DataController } from './data.controller';

export type ImportCsvStatus = 'imported' | 'empty' | 'cancelled';

export interface ImportCsvResult {
  status: ImportCsvStatus;
  imported: number;
  /** Transfer rows are not round-tripped (no pair id in the CSV). */
  skippedTransfers: number;
  skippedInvalid: number;
  /** Accounts created because their name was not found. */
  newAccounts: number;
  /** Rows whose category name matched nothing (imported without a category). */
  uncategorized: number;
}

/** Lower-cased type-label → kind, in BOTH locales, so either export imports. */
function buildKindLabelMap(): Record<string, TransactionKind> {
  const map: Record<string, TransactionKind> = {};
  for (const d of [en, ru]) {
    map[d.csv.kindExpense.toLowerCase()] = 'expense';
    map[d.csv.kindIncome.toLowerCase()] = 'income';
    map[d.csv.kindTransfer.toLowerCase()] = 'transfer';
  }
  return map;
}

/** Epoch seconds from a local 'YYYY-MM-DD' + 'HH:MM' at the device tz offset. */
function toOccurredAt(localDay: string, time: string, tzOffsetMin: number): number {
  const [y, mo, d] = localDay.split('-').map((n) => parseInt(n, 10));
  const [hh, mm] = time.split(':').map((n) => parseInt(n, 10));
  const utcMs = Date.UTC(y ?? 1970, (mo ?? 1) - 1, d ?? 1, hh ?? 12, mm ?? 0);
  return Math.floor(utcMs / 1000) - tzOffsetMin * 60;
}

/**
 * Imports transactions from a CSV the user picks (round-trips Centry's own
 * export). Reconstructs each expense/income row's signed minor amount and frozen
 * `rateToBaseE6` and inserts it via the low-level repo so history is preserved
 * exactly (rule 2) — NOT through the add funnel, which would re-freeze the rate.
 * Accounts are matched by name (created if missing); categories are matched by
 * name (left empty if unknown). Transfer rows are skipped (their two-leg pairing
 * can't be recovered from CSV). Nothing is uploaded — the file is read locally.
 */
async function importTransactionsCsv(): Promise<ImportCsvResult> {
  const empty: ImportCsvResult = {
    status: 'cancelled',
    imported: 0,
    skippedTransfers: 0,
    skippedInvalid: 0,
    newAccounts: 0,
    uncategorized: 0,
  };

  const text = await pickAndReadCsv();
  if (text === null) return empty;

  const parsed = parseTransactionsCsv(text, buildKindLabelMap());
  if (parsed.rows.length === 0) {
    return {
      ...empty,
      status: 'empty',
      skippedTransfers: parsed.skippedTransfers,
      skippedInvalid: parsed.skippedInvalid,
    };
  }

  const now = nowSec();
  const tz = currentTzOffsetMin();
  const accounts = await AccountsRepo.listAccounts(true);
  const categories = await CategoriesRepo.listCategories(true);

  const accountByName = new Map<string, string>();
  for (const a of accounts) accountByName.set(displayAccountName(a).toLowerCase(), a.id);
  const categoryByName = new Map<string, string>();
  for (const c of categories) categoryByName.set(displayCategoryName(c).toLowerCase(), c.id);

  const fallbackAccountId = accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id;
  let sortOrder = accounts.length;
  let newAccounts = 0;

  // Pre-create accounts whose name isn't found (in the row's own currency, since
  // account balances sum amounts without conversion).
  for (const row of parsed.rows) {
    const key = row.accountName.toLowerCase();
    if (!row.accountName || accountByName.has(key)) continue;
    const account: Account = {
      id: uuid(),
      name: row.accountName,
      currency: row.currency,
      kind: 'cash',
      icon: ACCOUNT_KIND_ICONS.cash,
      openingMinor: 0,
      sortOrder: sortOrder++,
      isDefault: false,
      targetMinor: null,
      color: null,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await AccountsRepo.createAccount(account);
    accountByName.set(key, account.id);
    newAccounts++;
  }

  let imported = 0;
  let uncategorized = 0;
  for (const row of parsed.rows) {
    const accountId = row.accountName
      ? accountByName.get(row.accountName.toLowerCase())
      : fallbackAccountId;
    if (!accountId) continue;

    let categoryId: string | null = null;
    if (row.categoryName) {
      categoryId = categoryByName.get(row.categoryName.toLowerCase()) ?? null;
      if (!categoryId) uncategorized++;
    }

    const tx: Transaction = {
      id: uuid(),
      accountId,
      categoryId,
      kind: row.kind,
      amountMinor: row.amountMinor,
      currency: row.currency,
      rateToBaseE6: row.rateToBaseE6,
      note: row.note || null,
      occurredAt: toOccurredAt(row.localDay, row.time, tz),
      localDay: row.localDay,
      transferPairId: null,
      authorId: 'me',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await TransactionsRepo.createTransaction(tx);
    imported++;
  }

  await DataController.loadAll();
  return {
    status: 'imported',
    imported,
    skippedTransfers: parsed.skippedTransfers,
    skippedInvalid: parsed.skippedInvalid,
    newAccounts,
    uncategorized,
  };
}

export const ImportController = { importTransactionsCsv };
