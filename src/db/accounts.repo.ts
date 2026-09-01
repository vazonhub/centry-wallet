import type { Account, AccountKind, CurrencyCode, Id } from '@models';

import { getDb } from './connection';

/** Raw row shape as stored in SQLite (snake_case, 0/1 booleans). */
interface AccountRow {
  id: string;
  name: string;
  currency: string;
  kind: string;
  icon: string | null;
  opening_minor: number;
  sort_order: number;
  is_default: number;
  created_at: number;
  updated_at: number;
  archived_at: number | null;
}

function mapRow(r: AccountRow): Account {
  return {
    id: r.id,
    name: r.name,
    currency: r.currency,
    kind: r.kind as AccountKind,
    icon: r.icon,
    openingMinor: r.opening_minor,
    sortOrder: r.sort_order,
    isDefault: r.is_default === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    archivedAt: r.archived_at,
  };
}

export async function createAccount(a: Account): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO accounts
       (id, name, currency, kind, icon, opening_minor, sort_order, is_default, created_at, updated_at, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      a.id,
      a.name,
      a.currency,
      a.kind,
      a.icon,
      a.openingMinor,
      a.sortOrder,
      a.isDefault ? 1 : 0,
      a.createdAt,
      a.updatedAt,
      a.archivedAt,
    ],
  );
}

export async function getAccount(id: Id): Promise<Account | null> {
  const db = getDb();
  const row = await db.getFirstAsync<AccountRow>(`SELECT * FROM accounts WHERE id = ?;`, [id]);
  return row ? mapRow(row) : null;
}

export async function listAccounts(includeArchived = false): Promise<Account[]> {
  const db = getDb();
  const rows = await db.getAllAsync<AccountRow>(
    `SELECT * FROM accounts
     ${includeArchived ? '' : 'WHERE archived_at IS NULL'}
     ORDER BY sort_order ASC, created_at ASC;`,
  );
  return rows.map(mapRow);
}

export async function getDefaultAccount(): Promise<Account | null> {
  const db = getDb();
  const row = await db.getFirstAsync<AccountRow>(
    `SELECT * FROM accounts WHERE is_default = 1 AND archived_at IS NULL LIMIT 1;`,
  );
  return row ? mapRow(row) : null;
}

/** Finds the first active account in a given currency (used to auto-suggest). */
export async function findAccountByCurrency(currency: CurrencyCode): Promise<Account | null> {
  const db = getDb();
  const row = await db.getFirstAsync<AccountRow>(
    `SELECT * FROM accounts WHERE currency = ? AND archived_at IS NULL ORDER BY sort_order ASC LIMIT 1;`,
    [currency],
  );
  return row ? mapRow(row) : null;
}

export async function renameAccount(id: Id, name: string, updatedAt: number): Promise<void> {
  const db = getDb();
  await db.runAsync(`UPDATE accounts SET name = ?, updated_at = ? WHERE id = ?;`, [
    name,
    updatedAt,
    id,
  ]);
}

/**
 * Edits an account's display fields plus its opening balance. Currency is
 * intentionally NOT editable — changing it would break balances/history computed
 * in the account's currency. `opening_minor` is the account's starting amount
 * (in its own currency), editable so a freshly added account can carry the money
 * the user already had.
 */
export async function updateAccount(
  id: Id,
  fields: { name: string; kind: AccountKind; icon: string | null; openingMinor: number },
  updatedAt: number,
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `UPDATE accounts SET name = ?, kind = ?, icon = ?, opening_minor = ?, updated_at = ? WHERE id = ?;`,
    [fields.name, fields.kind, fields.icon, fields.openingMinor, updatedAt, id],
  );
}

/**
 * Persists a new account ordering. `orderedIds` is the full visible order; each
 * account's `sort_order` is rewritten to its index in the array inside a single
 * transaction (rule 10: `updated_at` bumped so the change is sync-visible).
 * Accounts not in the list (e.g. archived) keep their existing `sort_order`.
 */
export async function reorderAccounts(orderedIds: Id[], updatedAt: number): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync(`UPDATE accounts SET sort_order = ?, updated_at = ? WHERE id = ?;`, [
        i,
        updatedAt,
        orderedIds[i] as string,
      ]);
    }
  });
}

/** Makes `id` the single default account (clears the flag on all others). */
export async function setDefaultAccount(id: Id, updatedAt: number): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE accounts SET is_default = 0, updated_at = ? WHERE is_default = 1;`, [
      updatedAt,
    ]);
    await db.runAsync(`UPDATE accounts SET is_default = 1, updated_at = ? WHERE id = ?;`, [
      updatedAt,
      id,
    ]);
  });
}

export async function archiveAccount(id: Id, archivedAt: number): Promise<void> {
  const db = getDb();
  await db.runAsync(`UPDATE accounts SET archived_at = ?, updated_at = ? WHERE id = ?;`, [
    archivedAt,
    archivedAt,
    id,
  ]);
}
