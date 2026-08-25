import type { CurrencyCode } from '@models';

/**
 * Display metadata for currency pickers. This is NOT a whitelist — Centry
 * supports any ISO-4217 code (B7); `@utils/money#getMinorUnits` is the
 * authority on decimal places. This list only powers the "common" section of
 * the picker. Base currency defaults to BYN for the author (B8).
 */
export const DEFAULT_BASE_CURRENCY: CurrencyCode = 'BYN';

export interface CurrencyMeta {
  code: CurrencyCode;
  /**
   * Fallback English display name. The picker localizes via
   * `@utils/displayName#currencyName` (i18n keys) — this is only a fallback.
   */
  name: string;
  symbol: string;
}

export const COMMON_CURRENCIES: readonly CurrencyMeta[] = [
  { code: 'BYN', name: 'Belarusian ruble', symbol: 'Br' },
  { code: 'USD', name: 'US dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'RUB', name: 'Russian ruble', symbol: '₽' },
  { code: 'PLN', name: 'Polish zloty', symbol: 'zł' },
  { code: 'UAH', name: 'Ukrainian hryvnia', symbol: '₴' },
  { code: 'GBP', name: 'Pound sterling', symbol: '£' },
  { code: 'GEL', name: 'Georgian lari', symbol: '₾' },
  { code: 'KZT', name: 'Kazakhstani tenge', symbol: '₸' },
] as const;
