/**
 * Budget planning model (replaces the payout-schedule engine). The user PLANS
 * how much they intend to spend over a calendar period (a week or a month); the
 * plan amount is entered in its own currency and converted to base. "Можно
 * сегодня" = plan ÷ days-in-period, with the carry-over plate tracking deviation
 * from that pace (docs/UX_SPEC.md#главная). Account balances feed only the
 * "денег может не хватить" warning, never the daily number.
 */

export type BudgetPeriod = 'week' | 'month';

export interface BudgetPlan {
  /** Whether the plan amount covers a calendar week or a calendar month. */
  period: BudgetPeriod;
  /** Planned spend for one period, in `currency` minor units (0 = not set). */
  amountMinor: number;
  /** Currency the plan amount is entered in (converted to base for the limit). */
  currency: string;
}

/** A plan is "not configured" until a positive amount is set. */
export function defaultBudgetPlan(baseCurrency: string): BudgetPlan {
  return { period: 'month', amountMinor: 0, currency: baseCurrency };
}

export interface PeriodBounds {
  /** First day of the current period, 'YYYY-MM-DD' (local). */
  startLocalDay: string;
  /** Whole days in the current period (7, or 28–31). */
  daysInPeriod: number;
  /** Whole days elapsed including today (≥ 1). */
  daysElapsed: number;
  /** Whole days remaining including today (≥ 1). */
  daysLeft: number;
}

/** 'YYYY-MM-DD' for a Date's local calendar day. */
function toLocalDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Calendar-period bounds around `now` (local time). Weeks start on Monday
 * (ru convention); months on the 1st. All day counts are inclusive of today, so
 * `daysElapsed + daysLeft - 1 === daysInPeriod`.
 */
export function periodBounds(period: BudgetPeriod, now: Date): PeriodBounds {
  if (period === 'week') {
    // getDay(): 0=Sun..6=Sat → days since Monday (Mon=0 … Sun=6).
    const sinceMonday = (now.getDay() + 6) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday);
    return {
      startLocalDay: toLocalDay(start),
      daysInPeriod: 7,
      daysElapsed: sinceMonday + 1,
      daysLeft: 7 - sinceMonday,
    };
  }
  // Month.
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startLocalDay: toLocalDay(start),
    daysInPeriod: daysInMonth,
    daysElapsed: dayOfMonth,
    daysLeft: daysInMonth - dayOfMonth + 1,
  };
}

/** Human label for a period, e.g. for the "не хватит на неделю" warning. */
export function periodLabel(period: BudgetPeriod): string {
  return period === 'week' ? 'неделю' : 'месяц';
}
