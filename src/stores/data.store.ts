import { create } from 'zustand';

import type { Account, Category, Transaction } from '@models';

/**
 * In-memory mirror of the data layer (SQLite is the source of truth). Controllers
 * write here after every mutation; views read via selectors. `rates` maps a
 * currency code → rate to base ×1e6 (the network-derived cache, B6).
 */
interface DataState {
  accounts: Account[];
  categories: Category[];
  recent: Transaction[];
  /** accountId → balance in the account's own currency (minor units). */
  balances: Record<string, number>;
  /** currency → rate to base ×1e6. */
  rates: Record<string, number>;
  loaded: boolean;

  setSnapshot(
    snapshot: Partial<Pick<DataState, 'accounts' | 'categories' | 'recent' | 'balances' | 'rates'>>,
  ): void;
}

const EMPTY_ACCOUNTS: Account[] = [];
const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_RECENT: Transaction[] = [];

export const useDataStore = create<DataState>((set) => ({
  accounts: EMPTY_ACCOUNTS,
  categories: EMPTY_CATEGORIES,
  recent: EMPTY_RECENT,
  balances: {},
  rates: {},
  loaded: false,

  setSnapshot: (snapshot) => set({ ...snapshot, loaded: true }),
}));

// --- Selectors -------------------------------------------------------------

export const selectExpenseCategories = (s: DataState): Category[] =>
  s.categories.filter((c) => c.kind === 'expense');

export const selectIncomeCategories = (s: DataState): Category[] =>
  s.categories.filter((c) => c.kind === 'income');

export const selectAccountById =
  (id: string | null) =>
  (s: DataState): Account | undefined =>
    id ? s.accounts.find((a) => a.id === id) : undefined;

export const selectDefaultAccount = (s: DataState): Account | undefined =>
  s.accounts.find((a) => a.isDefault) ?? s.accounts[0];
