import { create } from 'zustand';

import type { Transaction } from '@models';
import { monthNom, todayLocalDay } from '@utils/date';
import { monthRange, type DateRange } from '@utils/range';

export interface TopCategory {
  categoryId: string | null;
  totalMinor: number;
}

/** How the History period is chosen: a calendar month, a Mon–Sun week, or a free range. */
export type PeriodMode = 'month' | 'week' | 'custom';

/** State for the History tab — the currently viewed period and its aggregates. */
interface HistoryState {
  /** Which navigation unit is active (drives the top bar + arrows). */
  mode: PeriodMode;
  /** The inclusive local-day range currently shown (every query keys off this). */
  range: DateRange;
  /** 'YYYY-MM-DD' of the earliest data, or null when there is none (clamps nav). */
  earliestDay: string | null;
  transactions: Transaction[];
  incomeBaseMinor: number;
  outcomeBaseMinor: number;
  topCategories: TopCategory[];
  /** True while a period is being loaded — drives the skeleton on first open. */
  loading: boolean;
  setMode(mode: PeriodMode): void;
  setRange(range: DateRange): void;
  setLoading(loading: boolean): void;
  setSnapshot(
    s: Partial<
      Pick<
        HistoryState,
        'transactions' | 'incomeBaseMinor' | 'outcomeBaseMinor' | 'topCategories' | 'earliestDay'
      >
    >,
  ): void;
}

const EMPTY_TX: Transaction[] = [];
const EMPTY_TOP: TopCategory[] = [];

export const useHistoryStore = create<HistoryState>((set) => ({
  mode: 'month',
  range: monthRange(todayLocalDay()),
  earliestDay: null,
  transactions: EMPTY_TX,
  incomeBaseMinor: 0,
  outcomeBaseMinor: 0,
  topCategories: EMPTY_TOP,
  loading: true,
  setMode: (mode) => set({ mode }),
  setRange: (range) => set({ range }),
  setLoading: (loading) => set({ loading }),
  // A completed load always clears the loading flag.
  setSnapshot: (s) => set({ ...s, loading: false }),
}));

/** 'YYYY-MM' shifted by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map((n) => parseInt(n, 10));
  const d = new Date(y ?? 2026, (m ?? 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM' → 'Август 2026' / 'August 2026' (localized, nominative). */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map((n) => parseInt(n, 10));
  return `${monthNom((m ?? 1) - 1)} ${y ?? ''}`;
}
