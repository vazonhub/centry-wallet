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
