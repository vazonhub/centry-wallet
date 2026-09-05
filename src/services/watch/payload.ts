import type { Account, Transaction } from '@models';
import { type BudgetPlan } from '@utils/budget';
import { convertToBase } from '@utils/money';
import { computeAllowance } from '@utils/summary';

/**
 * The Apple Watch payload — everything the watch app renders, sent over
 * WatchConnectivity (App Groups don't cross to a separate device). Pure: the
 * caller injects localized strings and name resolvers, so this stays i18n-free
 * and testable, mirroring the widget snapshot builder.
 */

export interface WatchAccount {
  name: string;
  balanceMinor: number;
  currency: string;
}

export interface WatchRecent {
  note: string;
  amountMinor: number;
  currency: string;
  isIncome: boolean;
  isTransfer: boolean;
}

export interface WatchDayStat {
  /** 'YYYY-MM-DD'. */
  day: string;
  /** Base-minor spent that day (expenses only). */
  spentMinor: number;
}

export interface WatchPayload {
  /** UI language chosen on the phone; the watch mirrors it for its own chrome. */
  language: 'ru' | 'en';
  currency: string;
  allowanceTitle: string;
  spentLabel: string;
  remainingTodayMinor: number;
  perDayMinor: number;
  todaySpentMinor: number;
  periodRemainingMinor: number;
  periodLabel: string;
  accounts: WatchAccount[];
  recent: WatchRecent[];
  /** Expense-by-day over the last 30 days (base minor). */
  statsByDay: WatchDayStat[];
  /** Last expenses' base-minor magnitudes (newest first). */
  statsByTx: number[];
  /** Base-minor income/spend over the last 30 days (the numeric stats). */
  windowIncomeMinor: number;
  windowSpentMinor: number;
  /** Current budget plan, for the watch's budget editor. */
  budgetAmountMinor: number;
  budgetCurrency: string;
  updatedAt: number;
}

export interface BuildWatchPayloadInput {
  /** UI language chosen on the phone (drives the watch's own chrome + Siri hint). */
  language: 'ru' | 'en';
  /** Spend accounts (non-goal); the watch lists these. */
  accounts: Account[];
  balances: Record<string, number>;
  recent: Transaction[];
  base: string;
  rates: Record<string, number>;
  plan: BudgetPlan;
  spendAccountIds?: ReadonlySet<string>;
  todayLocalDay: string;
  now: Date;
  allowanceTitle: string;
  spentLabel: string;
  periodLabel: string;
  resolveAccountName: (a: Account) => string;
  resolveRecentNote: (t: Transaction) => string;
  /** Recent rows to include (default 30). */
  recentLimit?: number;
  /** By-transaction stat samples (default 20). */
  txStatLimit?: number;
}

/** 'YYYY-MM-DD' shifted back `n` days (parsed as a local calendar day). */
function shiftDay(localDay: string, n: number): string {
  const [y, m, d] = localDay.split('-').map((x) => parseInt(x, 10));
  const date = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - n);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildWatchPayload(input: BuildWatchPayloadInput): WatchPayload {
  const recentLimit = input.recentLimit ?? 30;
  const txStatLimit = input.txStatLimit ?? 20;

  const { perDayMinor, remainingTodayMinor, todaySpentMinor, periodBudgetMinor, periodSpentMinor } =
    computeAllowance({
      plan: input.plan,
      recent: input.recent,
      base: input.base,
      rates: input.rates,
      todayLocalDay: input.todayLocalDay,
      now: input.now,
      spendAccountIds: input.spendAccountIds,
    });
  const periodRemainingMinor = Math.max(0, periodBudgetMinor - periodSpentMinor);

  const accounts: WatchAccount[] = input.accounts.map((a) => ({
    name: input.resolveAccountName(a),
    balanceMinor: input.balances[a.id] ?? 0,
    currency: a.currency,
  }));

  const recent: WatchRecent[] = input.recent
    .filter((t) => !(t.kind === 'transfer' && t.amountMinor > 0)) // show a transfer once
    .slice(0, recentLimit)
    .map((t) => ({
      note: input.resolveRecentNote(t),
      amountMinor: t.amountMinor,
      currency: t.currency,
      isIncome: t.kind === 'income',
      isTransfer: t.kind === 'transfer',
    }));

  // Stats over the last 30 calendar days (all accounts, base currency).
  const windowStart = shiftDay(input.todayLocalDay, 29);
  const spentByDay = new Map<string, number>();
  const txSamples: number[] = [];
  let windowIncomeMinor = 0;
  let windowSpentMinor = 0;
  for (const t of input.recent) {
    if (t.kind === 'transfer') continue;
    if (t.localDay < windowStart) continue;
    const baseMinor = convertToBase(t.amountMinor, t.rateToBaseE6);
    if (t.amountMinor < 0) {
      windowSpentMinor += -baseMinor;
      spentByDay.set(t.localDay, (spentByDay.get(t.localDay) ?? 0) + -baseMinor);
      if (txSamples.length < txStatLimit) txSamples.push(-baseMinor);
    } else {
      windowIncomeMinor += baseMinor;
    }
  }
  const statsByDay: WatchDayStat[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = shiftDay(input.todayLocalDay, i);
    statsByDay.push({ day, spentMinor: spentByDay.get(day) ?? 0 });
  }

  return {
    language: input.language,
    currency: input.base,
    allowanceTitle: input.allowanceTitle,
    spentLabel: input.spentLabel,
    remainingTodayMinor,
    perDayMinor,
    todaySpentMinor,
    periodRemainingMinor,
    periodLabel: input.periodLabel,
    accounts,
    recent,
    statsByDay,
    statsByTx: txSamples,
    windowIncomeMinor,
    windowSpentMinor,
    budgetAmountMinor: input.plan.amountMinor,
    budgetCurrency: input.plan.currency,
    updatedAt: Math.floor(input.now.getTime() / 1000),
  };
}
