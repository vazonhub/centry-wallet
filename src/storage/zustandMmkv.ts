import type { StateStorage } from 'zustand/middleware';

import { storage } from './mmkv';

/**
 * Synchronous MMKV adapter for Zustand's `persist` middleware. Settings stores
 * mirror through this; SQLite remains the source of truth for data.
 */
export const mmkvStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => storage.delete(name),
};
