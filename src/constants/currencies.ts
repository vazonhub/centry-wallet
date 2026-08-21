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
  /** Russian display name. */
  name: string;
  symbol: string;
}

export const COMMON_CURRENCIES: readonly CurrencyMeta[] = [
  { code: 'BYN', name: 'Белорусский рубль', symbol: 'Br' },
  { code: 'USD', name: 'Доллар США', symbol: '$' },
  { code: 'EUR', name: 'Евро', symbol: '€' },
  { code: 'RUB', name: 'Российский рубль', symbol: '₽' },
  { code: 'PLN', name: 'Польский злотый', symbol: 'zł' },
  { code: 'UAH', name: 'Украинская гривна', symbol: '₴' },
  { code: 'GBP', name: 'Фунт стерлингов', symbol: '£' },
  { code: 'GEL', name: 'Грузинский лари', symbol: '₾' },
  { code: 'KZT', name: 'Казахстанский тенге', symbol: '₸' },
] as const;
