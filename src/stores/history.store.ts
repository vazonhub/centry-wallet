import { create } from 'zustand';

import type { Transaction } from '@models';
import { monthNom, monthPrefix, todayLocalDay } from '@utils/date';

export interface TopCategory {
  categoryId: string | null;
  totalMinor: number;
}

/** State for the History tab — the currently viewed month and its aggregates. */
interface HistoryState {
  month: string; // 'YYYY-MM'
  /** 'YYYY-MM' of the earliest data, or null when there is none. */
  earliestMonth: string | null;
  transactions: Transaction[];
  incomeBaseMinor: number;
  outcomeBaseMinor: number;
  topCategories: TopCategory[];
  /** True while a month is being loaded — drives the skeleton on first open. */
  loading: boolean;
  setMonth(month: string): void;
  setLoading(loading: boolean): void;
  setSnapshot(
    s: Partial<
      Pick<
        HistoryState,
        'transactions' | 'incomeBaseMinor' | 'outcomeBaseMinor' | 'topCategories' | 'earliestMonth'
      >
    >,
  ): void;
}

const EMPTY_TX: Transaction[] = [];
const EMPTY_TOP: TopCategory[] = [];

export const useHistoryStore = create<HistoryState>((set) => ({
  month: monthPrefix(todayLocalDay()),
  earliestMonth: null,
  transactions: EMPTY_TX,
  incomeBaseMinor: 0,
  outcomeBaseMinor: 0,
  topCategories: EMPTY_TOP,
  loading: true,
  setMonth: (month) => set({ month }),
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
