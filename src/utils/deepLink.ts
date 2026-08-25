/**
 * Deep-link parsing for the `centry://add` (also `centry://input`) entry point,
 * shared by the widget tap, the evening reminder and the Siri App Intent
 * (etap 8). Pure — takes the pieces `expo-linking` already parsed, so it runs in
 * plain Jest with no React Native import.
 *
 * The Siri intent (iOS 17+, targets injected by plugins/withAppIntents) opens
 * `centry://add?kind=expense&amount=12&note=…` via `OpenURLIntent` — no shared
 * MMKV store, so nothing double-links MMKVCore into the main target (the heap
 * corruption that disabled Siri, see docs/DECISIONS). The prefill rides entirely
 * in the URL and this parser turns it back into form seed values.
 */

import type { TransactionKind } from '@models';

const ADD_HOSTS = new Set(['add', 'input']);

/** Query params as `expo-linking` returns them (string | string[] | undefined). */
export type LinkQueryParams = Record<string, string | string[] | undefined> | null | undefined;

export interface ParsedAddLink {
  /** True when the URL is an add/input deep link. */
  isAdd: boolean;
  kind?: TransactionKind;
  /** Raw amount text; the sheet sanitizes it to the account currency's precision. */
  amount?: string;
  note?: string;
}

const isKind = (v: unknown): v is TransactionKind =>
  v === 'expense' || v === 'income' || v === 'transfer';

/** First value of a possibly-array query param, trimmed; undefined if empty. */
function firstParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Decides whether a parsed URL targets the input sheet and extracts any Siri
 * prefill from its query. `hostname`/`path` cover both `centry://add` (host) and
 * `centry:///add` (path) shapes, matching the existing widget handler.
 */
export function parseAddDeepLink(parsed: {
  hostname?: string | null;
  path?: string | null;
  queryParams?: LinkQueryParams;
}): ParsedAddLink {
  const host = parsed.hostname ?? '';
  const firstSegment = (parsed.path ?? '').replace(/^\/+/, '').split(/[/?#]/)[0] ?? '';
  const isAdd = ADD_HOSTS.has(host) || ADD_HOSTS.has(firstSegment);
  if (!isAdd) return { isAdd: false };

  const params = parsed.queryParams ?? {};
  const result: ParsedAddLink = { isAdd: true };

  const kind = firstParam(params.kind);
  if (isKind(kind)) result.kind = kind;

  const amount = firstParam(params.amount);
  if (amount) result.amount = amount;

  const note = firstParam(params.note);
  if (note) result.note = note;

  return result;
}
