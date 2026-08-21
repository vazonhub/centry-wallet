import { AccountsRepo, CategoriesRepo, TransactionsRepo, wipeAllData } from '@db';
import { ensureRates, getCachedRates } from '@services/rates';
import { refreshWidgetSnapshot } from '@services/widget';
import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';

import { seedDefaultsIfEmpty } from './seed';

/**
 * Loads the whole data snapshot from SQLite into the data store. Uses the
 * NETWORK-FREE cached rate table so the UI paints instantly and never blocks on
 * the network (a hung fetch must not stall app launch). Rates are refreshed
 * separately by {@link refreshRates}.
 */
async function loadAll(): Promise<void> {
  const [accounts, categories, recent] = await Promise.all([
    AccountsRepo.listAccounts(),
    CategoriesRepo.listCategories(),
    TransactionsRepo.listRecentTransactions(200),
  ]);

  const balances: Record<string, number> = {};
  await Promise.all(
    accounts.map(async (a) => {
      balances[a.id] = await TransactionsRepo.accountBalanceMinor(a.id);
    }),
  );

  const base = useSettingsStore.getState().baseCurrency;
  const rates = getCachedRates(base);

  useDataStore.getState().setSnapshot({ accounts, categories, recent, balances, rates });

  // Every data mutation funnels through loadAll, so this single hook keeps the
  // App-Group widget snapshot in lock-step with the store after each mutation
  // (and on bootstrap) — docs/DATA_MODEL.md#снимок-для-виджета. Best-effort.
  refreshWidgetSnapshot();
}

/**
 * Background rate refresh (the one network touch, B6). Never throws — on
 * failure the cached/fallback rates stay. Safe to fire-and-forget after load.
 */
async function refreshRates(): Promise<void> {
  const base = useSettingsStore.getState().baseCurrency;
  const rates = await ensureRates(base);
  useDataStore.getState().setSnapshot({ rates });
  refreshWidgetSnapshot(); // the hero total is rate-dependent — keep the widget in sync
}

/** Wipes all data and re-seeds defaults ("Удалить все данные" in settings). */
async function resetAllData(): Promise<void> {
  await wipeAllData();
  await seedDefaultsIfEmpty();
  await loadAll();
}

export const DataController = { loadAll, refreshRates, resetAllData };
