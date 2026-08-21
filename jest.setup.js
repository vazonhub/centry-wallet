/**
 * Global jest setup — registers mocks for native modules that pure-logic
 * modules pull in transitively (e.g. a util → store → MMKV chain).
 *
 * Centry uses MMKV instead of AsyncStorage. `react-native-mmkv` is a native
 * (JSI) module with no NativeModule under jest, so we provide an in-memory
 * mock. Pure money/date tests do not touch it, but store tests will.
 */
jest.mock('react-native-mmkv', () => {
  class MMKV {
    constructor() {
      this.store = new Map();
    }
    set(key, value) {
      this.store.set(key, value);
    }
    getString(key) {
      const v = this.store.get(key);
      return typeof v === 'string' ? v : undefined;
    }
    getNumber(key) {
      const v = this.store.get(key);
      return typeof v === 'number' ? v : undefined;
    }
    getBoolean(key) {
      const v = this.store.get(key);
      return typeof v === 'boolean' ? v : undefined;
    }
    contains(key) {
      return this.store.has(key);
    }
    delete(key) {
      this.store.delete(key);
    }
    getAllKeys() {
      return [...this.store.keys()];
    }
    clearAll() {
      this.store.clear();
    }
  }
  // Mirror the real module's `Mode` enum (used for the multi-process intent
  // channel in src/storage/mmkv.ts).
  const Mode = { SINGLE_PROCESS: 0, MULTI_PROCESS: 1 };
  return { MMKV, Mode };
});
