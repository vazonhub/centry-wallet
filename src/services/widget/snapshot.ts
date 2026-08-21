import type { Account, Category, Transaction } from '@models';
import type { PayoutSchedule } from '@utils/schedule';
import { computeAllowance } from '@utils/summary';

/**
 * The widget snapshot — the ONLY thing the WidgetKit extension reads
 * (docs/DATA_MODEL.md#снимок-для-виджета). The widget never opens SQLite and
 * never recomputes "можно сегодня" in Swift; it renders these frozen numbers,
 * so the logic can never drift between TS and Swift.
 */

/** How many recent entries the medium widget shows. */
export const WIDGET_RECENT_LIMIT = 3;

export interface WidgetAccountSnapshot {
  name: string;
  balanceMinor: number;
  currency: string;
}

export interface WidgetRecentSnapshot {
  icon: string;
  note: string;
  amountMinor: number;
  currency: string;
}

export interface WidgetSnapshot {
  /** Daily budget "можно сегодня" in base minor units. */
  perDayMinor: number;
  /** Base currency code (widget formats with it). */
  currency: string;
  /** Whole days until the next payday (≥ 1). */
  daysLeft: number;
  /** Base-minor spent today. */
  todaySpentMinor: number;
  accounts: WidgetAccountSnapshot[];
  recent: WidgetRecentSnapshot[];
  /** Epoch seconds when this snapshot was built. */
  updatedAt: number;
}

export interface BuildSnapshotInput {
  accounts: Account[];
  balances: Record<string, number>;
  recent: Transaction[];
  categories: Category[];
  base: string;
  /** currency → rate to base ×1e6 (to convert a foreign payout). */
  rates: Record<string, number>;
  /** Recurring payout schedule (B21). */
  schedule: PayoutSchedule;
  todayLocalDay: string;
  now: Date;
}

/** Icon for a feed row, mirroring the home screen mapping. */
function rowIcon(t: Transaction, category: Category | undefined): string {
  if (t.kind === 'transfer') return '🔁';
  return category?.icon ?? (t.amountMinor >= 0 ? '➕' : '•');
}

/** Human label for a feed row, mirroring the home screen mapping. */
function rowNote(t: Transaction, category: Category | undefined): string {
  if (t.kind === 'transfer') return 'Перевод';
  return t.note || category?.name || 'Без категории';
}

/** Builds the widget snapshot from the current data store slice. Pure. */
export function buildWidgetSnapshot(input: BuildSnapshotInput): WidgetSnapshot {
  const { perDayMinor, todaySpentMinor, daysLeft } = computeAllowance({
    schedule: input.schedule,
    recent: input.recent,
    base: input.base,
    rates: input.rates,
    todayLocalDay: input.todayLocalDay,
    now: input.now,
  });

  const categoryById = new Map(input.categories.map((c) => [c.id, c]));

  const accounts: WidgetAccountSnapshot[] = input.accounts.map((a) => ({
    name: a.name,
    balanceMinor: input.balances[a.id] ?? 0,
    currency: a.currency,
  }));

  const recent: WidgetRecentSnapshot[] = input.recent.slice(0, WIDGET_RECENT_LIMIT).map((t) => {
    const category = t.categoryId ? categoryById.get(t.categoryId) : undefined;
    return {
      icon: rowIcon(t, category),
      note: rowNote(t, category),
      amountMinor: t.amountMinor,
      currency: t.currency,
    };
  });

  return {
    perDayMinor,
    currency: input.base,
    daysLeft,
    todaySpentMinor,
    accounts,
    recent,
    updatedAt: Math.floor(input.now.getTime() / 1000),
  };
}
