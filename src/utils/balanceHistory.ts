import { convertToBase } from './money';

const E6_ONE = 1_000_000;

export interface DailyDelta {
  accountId: string;
  localDay: string;
  deltaMinor: number;
}

export interface BalancePoint {
  /** 'YYYY-MM-DD' (local). */
  day: string;
  /** Total balance across all accounts converted to base (minor units). */
  totalBaseMinor: number;
}

/** Ascending list of the last `n` local calendar days, ending today. */
export function lastNLocalDays(n: number, now: Date): string[] {
  const pad = (v: number) => String(v).padStart(2, '0');
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }
  return days;
}

export interface BalanceSeriesInput {
  accounts: { id: string; currency: string }[];
  /** accountId → current balance in the account's own currency (end of today). */
  currentBalances: Record<string, number>;
  /** Per-account, per-day net change within the window (own currency). */
  deltas: DailyDelta[];
  /** currency → rate to base ×1e6 (current rates — conversion is at today's rate). */
  rates: Record<string, number>;
  base: string;
  /** Ascending days to plot; the last element must be today. */
  days: string[];
}

/**
 * Balance-over-time series, computed on the fly from the current balances and
 * the per-day deltas (no snapshot table). Each account's own-currency balance is
 * walked backwards day by day — bal[D-1] = bal[D] − delta[D] — then every day's
 * balances are converted to base at the CURRENT rate, so the curve reflects
 * spending/income, not FX drift. The last point equals the displayed wallet
 * total.
 */
export function buildBalanceSeries(input: BalanceSeriesInput): BalancePoint[] {
  const { accounts, currentBalances, deltas, rates, base, days } = input;

  // accountId → (day → delta).
  const deltaByAccount = new Map<string, Map<string, number>>();
  for (const d of deltas) {
    let m = deltaByAccount.get(d.accountId);
    if (!m) {
      m = new Map();
      deltaByAccount.set(d.accountId, m);
    }
    m.set(d.localDay, (m.get(d.localDay) ?? 0) + d.deltaMinor);
  }

  const rateOf = (currency: string) => (currency === base ? E6_ONE : (rates[currency] ?? E6_ONE));

  // For each account, own-currency balance at the end of each plotted day.
  const ownByAccount = new Map<string, Map<string, number>>();
  for (const a of accounts) {
    const perDay = new Map<string, number>();
    let bal = currentBalances[a.id] ?? 0;
    const accDeltas = deltaByAccount.get(a.id);
    for (let i = days.length - 1; i >= 0; i--) {
      const day = days[i];
      if (day === undefined) continue;
      perDay.set(day, bal);
      bal -= accDeltas?.get(day) ?? 0; // step back to the previous day's end
    }
    ownByAccount.set(a.id, perDay);
  }

  return days.map((day) => {
    let total = 0;
    for (const a of accounts) {
      const own = ownByAccount.get(a.id)?.get(day) ?? 0;
      total += convertToBase(own, rateOf(a.currency));
    }
    return { day, totalBaseMinor: total };
  });
}

export interface TxDelta {
  accountId: string;
  currency: string;
  amountMinor: number;
  /** 'YYYY-MM-DD' (local) of the transaction. */
  localDay: string;
}

export interface TxBalancePoint {
  /** 1-based position of the transaction within the window (X axis). */
  index: number;
  /** 'YYYY-MM-DD' (local) of the transaction (for the selected caption). */
  day: string;
  /** Wallet total across the selected accounts, converted to base, after this tx. */
  totalBaseMinor: number;
}

/**
 * Per-transaction balance series — one point per transaction instead of per day.
 * Given the transactions in the window (ascending) and the CURRENT wallet total,
 * we know the last point, so we walk backwards: total-before-first = current −
 * Σ(all base deltas), then step forward adding each transaction's base delta. As
 * with {@link buildBalanceSeries}, conversion is at the current rate (the curve
 * reflects spending, not FX drift) and the last point equals the wallet total.
 */
export function buildTransactionSeries(input: {
  txs: TxDelta[];
  accountIds: string[];
  currentTotalBaseMinor: number;
  rates: Record<string, number>;
  base: string;
}): TxBalancePoint[] {
  const { txs, accountIds, currentTotalBaseMinor, rates, base } = input;
  const allow = new Set(accountIds);
  const rateOf = (currency: string) => (currency === base ? E6_ONE : (rates[currency] ?? E6_ONE));

  const relevant = txs.filter((t) => allow.has(t.accountId));
  const deltas = relevant.map((t) => convertToBase(t.amountMinor, rateOf(t.currency)));
  const sumAll = deltas.reduce((a, b) => a + b, 0);

  let running = currentTotalBaseMinor - sumAll;
  return relevant.map((t, i) => {
    running += deltas[i] ?? 0;
    return { index: i + 1, day: t.localDay, totalBaseMinor: running };
  });
}

// --- Income / expense flow series (wallet-total sheet flow dropdown) ---------

export interface FlowDayRow {
  localDay: string;
  incomeBaseMinor: number;
  expenseBaseMinor: number;
}

export interface FlowPoint {
  /** 'YYYY-MM-DD' (local) — the by-day bucket or the transaction's day. */
  day: string;
  /** Non-negative base-minor magnitude of income (or expense) for this point. */
  valueBaseMinor: number;
}

/**
 * Per-day income OR expense totals (base minor), zero-filled across `days` so the
 * chart always has one bar per plotted day (missing days read as 0 flow).
 */
export function buildFlowDaySeries(
  rows: FlowDayRow[],
  days: string[],
  mode: 'income' | 'expense',
): FlowPoint[] {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    byDay.set(r.localDay, mode === 'income' ? r.incomeBaseMinor : r.expenseBaseMinor);
  }
  return days.map((day) => ({ day, valueBaseMinor: byDay.get(day) ?? 0 }));
}

export interface FlowTxRow {
  localDay: string;
  amountMinor: number;
  rateToBaseE6: number;
}

/**
 * One point per income (or expense) transaction — value is the base-minor
 * magnitude, frozen at the transaction's own rate (matches History totals).
 */
export function buildFlowTxSeries(txs: FlowTxRow[], mode: 'income' | 'expense'): FlowPoint[] {
  const wanted = txs.filter((t) => (mode === 'income' ? t.amountMinor > 0 : t.amountMinor < 0));
  return wanted.map((t) => ({
    day: t.localDay,
    valueBaseMinor: Math.abs(convertToBase(t.amountMinor, t.rateToBaseE6)),
  }));
}
