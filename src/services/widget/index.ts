import { reloadAllTimelines } from 'expo-widgetkit-bridge';

import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import { WIDGET_SNAPSHOT_KEY, widgetStorage } from '@storage/mmkv';
import { todayLocalDay } from '@utils/date';

import { buildWidgetSnapshot } from './snapshot';

export type { WidgetSnapshot } from './snapshot';
export { buildWidgetSnapshot } from './snapshot';

/**
 * Rebuilds the widget snapshot from the current store state, writes it to the
 * App-Group MMKV, and asks WidgetKit to reload. Called by the controllers after
 * every data mutation (docs/DATA_MODEL.md#снимок-для-виджета) — this is the
 * single place snapshot writing lives (the "refresh the snapshot after each
 * mutation" hook the architecture pins to the controller layer).
 *
 * Never throws: a failure to refresh the widget must not break a save. It also
 * no-ops safely off-iOS (reloadAllTimelines is a no-op there, and MMKV just
 * writes to the local container).
 */
export function refreshWidgetSnapshot(): void {
  try {
    const data = useDataStore.getState();
    const settings = useSettingsStore.getState();

    const snapshot = buildWidgetSnapshot({
      accounts: data.accounts,
      balances: data.balances,
      recent: data.recent,
      categories: data.categories,
      base: settings.baseCurrency,
      rates: data.rates,
      schedule: settings.payoutSchedule,
      todayLocalDay: todayLocalDay(),
      now: new Date(),
    });

    widgetStorage.set(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
    reloadAllTimelines();
  } catch {
    // Widget refresh is best-effort; swallow so a save is never blocked.
  }
}
