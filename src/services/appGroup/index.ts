import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * App-Group UserDefaults bridge shared with the Siri App Intents
 * (plugins/withAppIntents). The app writes a formatted stats summary the info
 * intents read ("how much money / can spend / spent today"), and reads the
 * prefill an "Add expense/income" intent left behind. UserDefaults — not MMKV —
 * because a second MMKV consumer in the main target corrupts the heap (see
 * docs/DECISIONS); Foundation storage links nothing extra.
 *
 * `requireOptionalNativeModule` returns null until the app is prebuilt with the
 * `centry-native` module, so every call here safely no-ops in Expo Go / before a
 * native rebuild.
 */
interface CentryNative {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const native = requireOptionalNativeModule<CentryNative>('CentryNative');

const STATS_KEY = 'stats';
const ACCOUNTS_KEY = 'accounts';
const PENDING_ADD_KEY = 'pendingAdd';
const QUICK_ADD_QUEUE_KEY = 'quickAddQueue';

/** Preformatted display strings (money is formatted by @utils/money, rule 7). */
export interface SiriStats {
  total: string;
  canSpend: string;
  spentToday: string;
}

export interface PendingAdd {
  kind?: 'expense' | 'income' | 'transfer';
  amount?: string;
  note?: string;
  accountId?: string;
}

/** Account option offered by the "Add" App Intents' account parameter. */
export interface SiriAccount {
  id: string;
  name: string;
  currency: string;
}

/** Writes the stats summary the info App Intents read. Best-effort, iOS only. */
export function writeSiriStats(stats: SiriStats): void {
  try {
    native?.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Best-effort: never break a data refresh over the widget/Siri channel.
  }
}

/** Writes the account list the "Add" intents offer as the account parameter. */
export function writeSiriAccounts(accounts: SiriAccount[]): void {
  try {
    native?.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Best-effort.
  }
}

/**
 * One quick-add the interactive widget enqueued. `amountMajor` is a whole number
 * of major units (e.g. 5, 10) interpreted in the default account's currency when
 * the app drains it — the widget can't safely touch SQLite, so the save is
 * deferred to the next app activation.
 */
export interface QuickAdd {
  kind: 'expense' | 'income';
  amountMajor: number;
}

/** Reads and clears the interactive-widget quick-add queue (oldest first). */
export function consumeQuickAddQueue(): QuickAdd[] {
  try {
    const raw = native?.getItem(QUICK_ADD_QUEUE_KEY);
    if (!raw) return [];
    native?.removeItem(QUICK_ADD_QUEUE_KEY);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (q): q is QuickAdd =>
        !!q &&
        typeof (q as QuickAdd).amountMajor === 'number' &&
        ((q as QuickAdd).kind === 'expense' || (q as QuickAdd).kind === 'income'),
    );
  } catch {
    return [];
  }
}

/** Reads and clears the prefill an "Add" App Intent left behind, if any. */
export function consumePendingAdd(): PendingAdd | null {
  try {
    const raw = native?.getItem(PENDING_ADD_KEY);
    if (!raw) return null;
    native?.removeItem(PENDING_ADD_KEY);
    return JSON.parse(raw) as PendingAdd;
  } catch {
    return null;
  }
}
