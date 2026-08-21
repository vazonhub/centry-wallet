/**
 * Domain models — the TypeScript mirror of the SQLite schema
 * (see docs/DATA_MODEL.md). SQL lives only in `src/db`; these types are the
 * shape controllers and views work with.
 *
 * Money invariants (docs/PROJECT_BRIEF.md §3):
 * - all amounts are INTEGER minor units (rule 1) — never float;
 * - `rateToBaseE6` is the exchange rate ×1_000_000, frozen at write time (rule 2);
 * - soft delete only: `deletedAt` is set, rows are never physically removed (rule 10).
 */

/** Epoch seconds (UTC). */
export type EpochSeconds = number;

/** ISO-4217 currency code, e.g. 'BYN', 'USD', 'EUR'. Universal — not a fixed list (B7). */
export type CurrencyCode = string;

/** 'YYYY-MM-DD' in the local zone captured at write time (rule 8). */
export type LocalDay = string;

/** UUID (generated in TS so the schema is merge-ready across devices). */
export type Id = string;

// --- Accounts --------------------------------------------------------------

export type AccountKind = 'card' | 'cash' | 'wallet';

export interface Account {
  id: Id;
  name: string;
  currency: CurrencyCode;
  kind: AccountKind;
  /** Optional emoji / SF Symbol name. */
  icon: string | null;
  /** Opening balance in minor units of `currency`. */
  openingMinor: number;
  sortOrder: number;
  isDefault: boolean;
  createdAt: EpochSeconds;
  updatedAt: EpochSeconds;
  /** Accounts are archived, not deleted. */
  archivedAt: EpochSeconds | null;
}

// --- Categories ------------------------------------------------------------

export type CategoryKind = 'expense' | 'income';

export interface Category {
  id: Id;
  name: string;
  /** Emoji or SF Symbol name. */
  icon: string;
  /** Accent hex (category colour is decorative — it never encodes +/−, rule 6). */
  color: string;
  kind: CategoryKind;
  isSystem: boolean;
  sortOrder: number;
  createdAt: EpochSeconds;
  updatedAt: EpochSeconds;
  deletedAt: EpochSeconds | null;
}

// --- Transactions ----------------------------------------------------------

export type TransactionKind = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: Id;
  accountId: Id;
  /** Null for transfers. */
  categoryId: Id | null;
  kind: TransactionKind;
  /** Minor units of `currency`. Expenses are negative, income positive (rule 1). */
  amountMinor: number;
  currency: CurrencyCode;
  /** Rate to the base currency ×1_000_000, frozen at write time (rule 2). */
  rateToBaseE6: number;
  note: string | null;
  occurredAt: EpochSeconds;
  /** Local calendar day captured at write time (rule 8). */
  localDay: LocalDay;
  /** Links the two rows of a transfer (source/destination). */
  transferPairId: Id | null;
  /** Sync/shared-mode readiness (rule 10). Defaults to 'me'. */
  authorId: string;
  createdAt: EpochSeconds;
  updatedAt: EpochSeconds;
  deletedAt: EpochSeconds | null;
}
