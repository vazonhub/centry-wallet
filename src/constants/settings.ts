import { DEFAULT_BASE_CURRENCY } from './currencies';

/**
 * MMKV setting keys and their defaults (docs/DATA_MODEL.md#mmkv--ключи-настроек).
 * The Zustand settings store mirrors these; SQLite remains the source of truth
 * for data. Rates cache keys live here too (the only network-derived values).
 */
export const SETTINGS_KEYS = {
  baseCurrency: 'base_currency',
  paydayDay: 'payday_day',
  theme: 'theme',
  inputSiri: 'input_siri',
  inputEveningPush: 'input_evening_push',
  eveningPushTime: 'evening_push_time',
  hideAmounts: 'hide_amounts',
  schemaVersion: 'schema_version',
  ratesCacheJson: 'rates_cache_json',
  ratesSyncedAt: 'rates_synced_at',
  ratesManualJson: 'rates_manual_json',
} as const;

export type ThemeChoice = 'system' | 'light' | 'dark';

export const SETTINGS_DEFAULTS = {
  baseCurrency: DEFAULT_BASE_CURRENCY,
  theme: 'system' as ThemeChoice,
  inputSiri: true,
  inputEveningPush: true,
  eveningPushTime: '22:00',
  hideAmounts: false,
} as const;
