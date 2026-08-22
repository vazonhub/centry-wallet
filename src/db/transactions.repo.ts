import type { Id, Transaction, TransactionKind } from '@models';

import { getDb } from './connection';

interface TransactionRow {
  id: string;
  account_id: string;
  category_id: string | null;
  kind: string;
  amount_minor: number;
  currency: string;
  rate_to_base_e6: number;
  note: string | null;
  occurred_at: number;
  local_day: string;
  transfer_pair_id: string | null;
  author_id: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

function mapRow(r: TransactionRow): Transaction {
  return {
    id: r.id,
    accountId: r.account_id,
    categoryId: r.category_id,
    kind: r.kind as TransactionKind,
    amountMinor: r.amount_minor,
    currency: r.currency,
    rateToBaseE6: r.rate_to_base_e6,
    note: r.note,
    occurredAt: r.occurred_at,
    localDay: r.local_day,
    transferPairId: r.transfer_pair_id,
    authorId: r.author_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export async function createTransaction(t: Transaction): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO transactions
       (id, account_id, category_id, kind, amount_minor, currency, rate_to_base_e6, note,
        occurred_at, local_day, transfer_pair_id, author_id, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      t.id,
      t.accountId,
      t.categoryId,
      t.kind,
      t.amountMinor,
      t.currency,
      t.rateToBaseE6,
      t.note,
      t.occurredAt,
      t.localDay,
      t.transferPairId,
      t.authorId,
      t.createdAt,
      t.updatedAt,
      t.deletedAt,
    ],
  );
}

export async function getTransaction(id: Id): Promise<Transaction | null> {
  const db = getDb();
  const row = await db.getFirstAsync<TransactionRow>(`SELECT * FROM transactions WHERE id = ?;`, [
    id,
  ]);
  return row ? mapRow(row) : null;
}

/** Most recent transactions (for the home feed / widget snapshot). */
export async function listRecentTransactions(limit = 50): Promise<Transaction[]> {
  const db = getDb();
  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT * FROM transactions WHERE deleted_at IS NULL
     ORDER BY occurred_at DESC, created_at DESC LIMIT ?;`,
    [limit],
  );
  return rows.map(mapRow);
}

/** Transactions for a month, `monthPrefix` = 'YYYY-MM' (matched against local_day). */
export async function listTransactionsByMonth(monthPrefix: string): Promise<Transaction[]> {
  const db = getDb();
  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT * FROM transactions
     WHERE deleted_at IS NULL AND local_day LIKE ? || '%'
     ORDER BY local_day DESC, occurred_at DESC;`,
    [monthPrefix],
  );
  return rows.map(mapRow);
}

export async function updateTransactionMeta(
  id: Id,
  fields: { categoryId?: Id | null; note?: string | null },
  updatedAt: number,
): Promise<void> {
  const db = getDb();
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  if ('categoryId' in fields) {
    sets.push('category_id = ?');
    params.push(fields.categoryId ?? null);
  }
  if ('note' in fields) {
    sets.push('note = ?');
    params.push(fields.note ?? null);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(updatedAt, id);
  await db.runAsync(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?;`, params);
}

/**
 * Corrects a transaction's amount (signed minor units — negative expense,
 * positive income). The currency and frozen rate are unchanged; only the
 * magnitude/sign of what was recorded. Not for transfers (their two legs must
 * stay in sync).
 */
export async function updateTransactionAmount(
  id: Id,
  amountMinor: number,
  updatedAt: number,
): Promise<void> {
  const db = getDb();
  await db.runAsync(`UPDATE transactions SET amount_minor = ?, updated_at = ? WHERE id = ?;`, [
    amountMinor,
    updatedAt,
    id,
  ]);
}

export async function updateTransactionDate(
  id: Id,
  occurredAt: number,
  localDay: string,
  updatedAt: number,
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `UPDATE transactions SET occurred_at = ?, local_day = ?, updated_at = ? WHERE id = ?;`,
    [occurredAt, localDay, updatedAt, id],
  );
}

export async function softDeleteTransaction(id: Id, deletedAt: number): Promise<void> {
  const db = getDb();
  await db.runAsync(`UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ?;`, [
    deletedAt,
    deletedAt,
    id,
  ]);
}

// --- Aggregates (docs/DATA_MODEL.md#ключевые-запросы) ----------------------
// NOTE: SQL `* rate / 1e6` truncates toward zero. Fine for on-screen aggregates;
// the canonical half-up rounding lives in @utils/money and is applied per
// transaction at write time.

/** 'YYYY-MM' of the earliest non-deleted transaction, or null if there are none. */
export async function earliestMonth(): Promise<string | null> {
  const db = getDb();
  const row = await db.getFirstAsync<{ m: string | null }>(
    `SELECT substr(MIN(local_day), 1, 7) AS m FROM transactions WHERE deleted_at IS NULL;`,
  );
  return row?.m ?? null;
}

/** Distinct currencies used by non-deleted transactions. */
export async function distinctTransactionCurrencies(): Promise<string[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ currency: string }>(
    `SELECT DISTINCT currency FROM transactions WHERE deleted_at IS NULL;`,
  );
  return rows.map((r) => r.currency);
}

/**
 * Re-freezes the base-conversion rate for every non-deleted transaction of a
 * currency — used when the user changes the base currency, so all base-currency
 * views agree. The recorded money (amount_minor/currency) is never touched, only
 * the derived rate_to_base_e6.
 */
export async function rebaseCurrencyRate(
  currency: string,
  rateToBaseE6: number,
  updatedAt: number,
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `UPDATE transactions SET rate_to_base_e6 = ?, updated_at = ? WHERE currency = ? AND deleted_at IS NULL;`,
    [rateToBaseE6, updatedAt, currency],
  );
}

/** Account balance in the account's own currency (minor units). */
export async function accountBalanceMinor(accountId: Id): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ balance_minor: number }>(
    `SELECT a.opening_minor + COALESCE(SUM(t.amount_minor), 0) AS balance_minor
     FROM accounts a
     LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL
     WHERE a.id = ? GROUP BY a.id;`,
    [accountId],
  );
  return row?.balance_minor ?? 0;
}

/** Month income/outcome totals in the base currency (minor units). */
export async function monthTotalsBaseMinor(
  monthPrefix: string,
): Promise<{ income: number; outcome: number }> {
  const db = getDb();
  const row = await db.getFirstAsync<{ income: number | null; outcome: number | null }>(
    `SELECT
       SUM(CASE WHEN amount_minor > 0 THEN  amount_minor * rate_to_base_e6 / 1000000 ELSE 0 END) AS income,
       SUM(CASE WHEN amount_minor < 0 THEN -amount_minor * rate_to_base_e6 / 1000000 ELSE 0 END) AS outcome
     FROM transactions
     WHERE deleted_at IS NULL AND kind != 'transfer' AND local_day LIKE ? || '%';`,
    [monthPrefix],
  );
  return { income: row?.income ?? 0, outcome: row?.outcome ?? 0 };
}

/**
 * Per-account, per-day net change (own currency, minor units) since a local day,
 * for the balance-over-time chart. Includes transfers (they move an account's
 * balance) and every non-deleted amount, mirroring `accountBalanceMinor`.
 */
export async function dailyDeltasByAccountSince(
  sinceLocalDay: string,
): Promise<{ accountId: string; localDay: string; deltaMinor: number }[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ account_id: string; local_day: string; delta: number }>(
    `SELECT account_id, local_day, SUM(amount_minor) AS delta
     FROM transactions
     WHERE deleted_at IS NULL AND local_day >= ?
     GROUP BY account_id, local_day
     ORDER BY local_day ASC;`,
    [sinceLocalDay],
  );
  return rows.map((r) => ({
    accountId: r.account_id,
    localDay: r.local_day,
    deltaMinor: r.delta,
  }));
}

/** Top expense categories for a month (base minor units), descending. */
export async function topCategoriesBaseMinor(
  monthPrefix: string,
  limit = 5,
): Promise<{ categoryId: string | null; totalMinor: number }[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ category_id: string | null; total: number }>(
    `SELECT category_id, SUM(-amount_minor * rate_to_base_e6 / 1000000) AS total
     FROM transactions
     WHERE deleted_at IS NULL AND kind != 'transfer' AND amount_minor < 0 AND local_day LIKE ? || '%'
     GROUP BY category_id ORDER BY total DESC LIMIT ?;`,
    [monthPrefix, limit],
  );
  return rows.map((r) => ({ categoryId: r.category_id, totalMinor: r.total }));
}
