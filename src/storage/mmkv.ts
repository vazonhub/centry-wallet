import { MMKV, Mode } from 'react-native-mmkv';

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
 *
 * MUST be `MULTI_PROCESS`: the WidgetKit extension is a SEPARATE process reading
 * this file. In single-process mode the two processes don't share the
 * inter-process lock, so the widget opens a stale/empty view and renders all
 * zeros (the "связка есть, данные не пробрасываются" bug from Bsuir Time). Both
 * sides must agree — the Swift reader opens with `.multiProcess` too
 * (targets/widget/SnapshotStore.swift).
 */
export const widgetStorage = new MMKV({ id: WIDGET_MMAP_ID, mode: Mode.MULTI_PROCESS });

// NOTE: the Siri App Intent (etap 8) intentionally has NO MMKV channel. An
// earlier design wrote the prefill to an App-Group MMKV (`centry.intent`), which
// required linking a second MMKVCore consumer (MMKVAppExtension) into the main
// target — the app already links MMKVCore via react-native-mmkv, so two
// consumers in one process corrupted the heap at launch and crashed Hermes. The
// intent now passes the prefill entirely through the `centry://add?…` deep link
// (src/utils/deepLink + useWidgetDeepLink); nothing is stored, nothing extra is
// linked. See docs/DECISIONS + memory [[centry-siri-appintents]].

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
