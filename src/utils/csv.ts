/**
 * CSV building — pure serialization (RFC 4180) plus the transactions-specific
 * row assembly. Imports nothing from React Native so it runs in plain Jest.
 *
 * Money is formatted only through `@utils/money` (rule 7): amounts become plain
 * dot-decimal strings a spreadsheet parses as numbers, never floats in our math.
 */

import type { Account, Category, CurrencyCode, Transaction, TransactionKind } from '@models';

import { convertToBase, formatMoneyPlain } from './money';

/** UTF-8 byte-order mark — makes Excel open a UTF-8 CSV with correct Cyrillic. */
export const CSV_BOM = '﻿';

/**
 * Escapes a single CSV field per RFC 4180: a field is quoted when it contains a
 * comma, double-quote, CR or LF, and any inner double-quote is doubled.
 */
function escapeField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serializes a matrix of fields into an RFC 4180 CSV string (CRLF line breaks).
 * Every field is escaped; the header row is just the first `rows` entry.
 */
export function serializeCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeField).join(',')).join('\r\n');
}

/** 'HH:MM' local wall-clock time of an instant (same tz trick as `localDay`). */
function localTime(occurredAtSec: number, tzOffsetMin: number): string {
  const d = new Date((occurredAtSec + tzOffsetMin * 60) * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** rate_to_base_e6 as a trimmed decimal string, e.g. 3270000 → "3.27", 1000000 → "1". */
function rateE6ToString(rateE6: number): string {
  const negative = rateE6 < 0;
  const abs = BigInt(negative ? -rateE6 : rateE6);
  const int = abs / 1_000_000n;
  const frac = (abs % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  const body = frac ? `${int}.${frac}` : `${int}`;
  return negative ? `-${body}` : body;
}

export interface BuildCsvInput {
  transactions: readonly Transaction[];
  /** All accounts including archived — for resolving names of historic rows. */
  accounts: readonly Account[];
  /** All categories including deleted — for resolving names of historic rows. */
  categories: readonly Category[];
  baseCurrency: CurrencyCode;
  /** Minutes east of UTC, for rendering each row's local time (device tz). */
  tzOffsetMin: number;
  /** Localized column headers, in row order (11 columns). */
  columns: readonly string[];
  /** Localized transaction-kind labels. */
  kindLabels: Record<TransactionKind, string>;
  /** Localized display name for an account (seed names → UI language). */
  resolveAccountName: (account: Account) => string;
  /** Localized display name for a category. */
  resolveCategoryName: (category: Category) => string;
}

/**
 * Assembles the full transactions export as an RFC 4180 CSV string (no BOM —
 * the writer prepends {@link CSV_BOM}). Rows are chronological (oldest first).
 * Pure: the caller supplies localized headers, kind labels and name resolvers
 * (so this stays i18n-free and testable). Every money value passes through
 * `@utils/money`; the base amount uses each transaction's frozen `rateToBaseE6`
 * (rule 2), so the export matches history.
 */
export function buildTransactionsCsv(input: BuildCsvInput): string {
  const { transactions, accounts, categories, baseCurrency, tzOffsetMin } = input;
  const { columns, kindLabels, resolveAccountName, resolveCategoryName } = input;

  const accountName = new Map(accounts.map((a) => [a.id, resolveAccountName(a)]));
  const categoryName = new Map(categories.map((c) => [c.id, resolveCategoryName(c)]));

  const ordered = [...transactions].sort((a, b) => a.occurredAt - b.occurredAt);

  const rows: string[][] = [[...columns]];
  for (const t of ordered) {
    const baseMinor = convertToBase(t.amountMinor, t.rateToBaseE6);
    rows.push([
      t.localDay,
      localTime(t.occurredAt, tzOffsetMin),
      kindLabels[t.kind],
      accountName.get(t.accountId) ?? '',
      t.categoryId ? (categoryName.get(t.categoryId) ?? '') : '',
      formatMoneyPlain(t.amountMinor, t.currency),
      t.currency.toUpperCase(),
      formatMoneyPlain(baseMinor, baseCurrency),
      baseCurrency.toUpperCase(),
      rateE6ToString(t.rateToBaseE6),
      t.note ?? '',
    ]);
  }

  return serializeCsv(rows);
}
