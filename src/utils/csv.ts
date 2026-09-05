/**
 * CSV building — pure serialization (RFC 4180) plus the transactions-specific
 * row assembly. Imports nothing from React Native so it runs in plain Jest.
 *
 * Money is formatted only through `@utils/money` (rule 7): amounts become plain
 * dot-decimal strings a spreadsheet parses as numbers, never floats in our math.
 */

import type { Account, Category, CurrencyCode, Transaction, TransactionKind } from '@models';

import { convertToBase, formatMoneyPlain, parseAmountToMinor, parseRateToE6 } from './money';

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

// --- Import (round-trips our own export) -----------------------------------

/**
 * Parses an RFC 4180 CSV string into a matrix of fields. Handles a leading BOM,
 * quoted fields (with doubled `""` escapes), and CRLF or LF line breaks. A
 * trailing newline does not produce an empty final row.
 */
export function parseCsv(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let sawField = false; // did the current row have any content?

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
      sawField = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
      sawField = true;
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++; // consume CRLF as one break
      if (sawField || field !== '') {
        row.push(field);
        rows.push(row);
      }
      field = '';
      row = [];
      sawField = false;
    } else {
      field += c;
      sawField = true;
    }
  }
  if (sawField || field !== '') {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** One expense/income row reconstructed from an exported CSV. */
export interface ImportedTxRow {
  localDay: string;
  /** 'HH:MM' local time (falls back to '12:00' when absent). */
  time: string;
  accountName: string;
  categoryName: string;
  /** Signed minor units of `currency` (expense negative, income positive). */
  amountMinor: number;
  currency: string;
  rateToBaseE6: number;
  note: string;
  kind: 'expense' | 'income';
}

export interface ParseImportResult {
  rows: ImportedTxRow[];
  /** Transfer rows are skipped (two-leg pairs can't be reconstructed from CSV). */
  skippedTransfers: number;
  /** Rows dropped as malformed (bad amount/currency/column count). */
  skippedInvalid: number;
}

const COL = {
  date: 0,
  time: 1,
  type: 2,
  account: 3,
  category: 4,
  amount: 5,
  currency: 6,
  rate: 9,
  note: 10,
} as const;

/**
 * Interprets the matrix from {@link parseCsv} as our transactions export. Maps
 * columns by POSITION (headers are localized, so their text can't be keyed on)
 * and reconstructs each row's signed minor amount and frozen `rateToBaseE6`,
 * preserving history (rule 2). `kindLabelMap` maps lower-cased type labels (both
 * locales) to a kind so transfers are recognised and skipped; when a label is
 * unknown, the kind falls back to the amount's sign. Resolving account/category
 * names to ids happens in the controller (it needs the DB).
 */
export function parseTransactionsCsv(
  text: string,
  kindLabelMap: Record<string, TransactionKind>,
): ParseImportResult {
  const matrix = parseCsv(text);
  const rows: ImportedTxRow[] = [];
  let skippedTransfers = 0;
  let skippedInvalid = 0;

  // Drop the header row (first row) — it always exists in our export.
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    if (!cells || cells.length < COL.currency + 1) {
      skippedInvalid++;
      continue;
    }
    const currency = (cells[COL.currency] ?? '').trim().toUpperCase();
    const amountRaw = (cells[COL.amount] ?? '').trim();
    if (!currency || !amountRaw) {
      skippedInvalid++;
      continue;
    }

    const negative = amountRaw.startsWith('-');
    const magnitude = parseAmountToMinor(negative ? amountRaw.slice(1) : amountRaw, currency);
    if (magnitude === null) {
      skippedInvalid++;
      continue;
    }
    const amountMinor = negative ? -magnitude : magnitude;

    const typeLabel = (cells[COL.type] ?? '').trim().toLowerCase();
    const labelledKind = kindLabelMap[typeLabel];
    if (labelledKind === 'transfer') {
      skippedTransfers++;
      continue;
    }
    const kind: 'expense' | 'income' =
      labelledKind === 'income' || labelledKind === 'expense'
        ? labelledKind
        : amountMinor >= 0
          ? 'income'
          : 'expense';

    const rateToBaseE6 = parseRateToE6((cells[COL.rate] ?? '').trim()) ?? 1_000_000;
    const timeRaw = (cells[COL.time] ?? '').trim();

    rows.push({
      localDay: (cells[COL.date] ?? '').trim(),
      time: /^\d{1,2}:\d{2}$/.test(timeRaw) ? timeRaw : '12:00',
      accountName: (cells[COL.account] ?? '').trim(),
      categoryName: (cells[COL.category] ?? '').trim(),
      amountMinor,
      currency,
      rateToBaseE6,
      note: cells[COL.note] ?? '',
      kind,
    });
  }

  return { rows, skippedTransfers, skippedInvalid };
}
