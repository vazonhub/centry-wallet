import { MMKV } from 'react-native-mmkv';

/**
 * MMKV holds settings and derived values only — everything here is
 * recomputable from SQLite, so losing MMKV never loses data
 * (docs/DATA_MODEL.md). SQLite (`src/db`) is the source of truth.
 */

/** App-local settings store. */
export const storage = new MMKV({ id: 'centry' });

/**
 * App Group container id shared with the WidgetKit extension. Declared as the
 * `AppGroup` key in `ios.infoPlist` (app.json) so react-native-mmkv places its
 * files in the shared container — the widget then reads them with the same
 * `mmapID`. (When `AppGroup` is set and `path` is undefined, MMKV uses the App
 * Group directory — see react-native-mmkv Types.d.ts.)
 */
export const APP_GROUP_ID = 'group.by.vazon.centry';

/** MMKV mmapID the WidgetKit extension opens to read the snapshot. */
export const WIDGET_MMAP_ID = 'centry.widget';

/** MMKV key under which the widget snapshot JSON string is stored. */
export const WIDGET_SNAPSHOT_KEY = 'snapshot';

/**
 * App-Group MMKV instance holding the widget snapshot. Lives in the shared
 * container (see {@link APP_GROUP_ID}) so the Swift widget can read it. Only the
 * derived snapshot lives here — never the source of truth (that is SQLite).
 */
export const widgetStorage = new MMKV({ id: WIDGET_MMAP_ID });

/**
 * MMKV mmapID for the Siri App-Intent prefill channel (etap 8). Single-process,
 * like {@link widgetStorage} (proven safe). NOTE: the native writer (the Swift
 * App Intent) is currently backed out — linking a second MMKVCore consumer into
 * the main target risked heap corruption at launch. The JS reader stays wired
 * and harmless (finds nothing) so Siri can be re-enabled once a channel that
 * doesn't double-link MMKVCore is in place. See docs/DECISIONS + memory
 * [[centry-siri-appintents]].
 */
export const INTENT_MMAP_ID = 'centry.intent';

/** MMKV key under which the App Intent would store the pending prefill JSON. */
export const INTENT_PENDING_KEY = 'pending';

/** App-Group MMKV instance for the Swift→JS App-Intent prefill channel. */
export const intentStorage = new MMKV({ id: INTENT_MMAP_ID });

/** Typed convenience wrappers over the settings store. */
export const settingsStorage = {
  getString: (key: string): string | undefined => storage.getString(key),
  setString: (key: string, value: string): void => storage.set(key, value),
  getNumber: (key: string): number | undefined => storage.getNumber(key),
  setNumber: (key: string, value: number): void => storage.set(key, value),
  getBoolean: (key: string): boolean | undefined => storage.getBoolean(key),
  setBoolean: (key: string, value: boolean): void => storage.set(key, value),
  delete: (key: string): void => storage.delete(key),
};
