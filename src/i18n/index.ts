import i18n from 'i18next';
import { NativeModules, Platform } from 'react-native';
import { initReactI18next } from 'react-i18next';

import { setDateLocale } from '@utils/date';
import { setMoneyLocale } from '@utils/money';

import { en } from './en';
import { ru } from './ru';

/**
 * Localization (RU / EN). Mirrors the Bsuir setup: i18next + react-i18next, the
 * device language read straight from NativeModules (no extra native library).
 * The chosen language also drives money and date formatting via
 * {@link applyLanguage} — money separators (rule 7) and month/weekday names.
 */

export type LanguageChoice = 'ru' | 'en';

const SUPPORTED: LanguageChoice[] = ['ru', 'en'];

/** Device language tag ('ru', 'en', …) without a native localization library. */
const getDeviceLanguageTag = (): string | undefined => {
  if (Platform.OS === 'ios') {
    const settings = NativeModules.SettingsManager?.settings as
      { AppleLocale?: string; AppleLanguages?: string[] } | undefined;
    const raw = settings?.AppleLocale ?? settings?.AppleLanguages?.[0];
    return raw?.split(/[-_]/)[0]?.toLowerCase();
  }
  const locale = (NativeModules.I18nManager as { localeIdentifier?: string } | undefined)
    ?.localeIdentifier;
  return locale?.split(/[-_]/)[0]?.toLowerCase();
};

/** Device region code (e.g. 'BY', 'US', 'PL') from the locale, or undefined. */
export const getDeviceRegion = (): string | undefined => {
  const locale = (NativeModules.I18nManager as { localeIdentifier?: string } | undefined)
    ?.localeIdentifier;
  return locale?.split(/[-_]/)[1]?.toUpperCase();
};

/** Maps the device locale to a supported language: Russian → 'ru', else 'en'. */
export const getSystemLanguage = (): LanguageChoice => {
  const tag = getDeviceLanguageTag();
  return tag === 'ru' ? 'ru' : 'en';
};

void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: getSystemLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/**
 * Applies a language across the app: i18next strings, money separators
 * (`@utils/money`) and month/weekday names (`@utils/date`). The single entry
 * point the settings store and bootstrap call so all three stay in lock-step.
 */
export function applyLanguage(lang: LanguageChoice): void {
  if (!SUPPORTED.includes(lang)) lang = 'en';
  void i18n.changeLanguage(lang);
  setMoneyLocale(lang);
  setDateLocale(lang);
}

// Keep money/date in sync with the initial language chosen above.
applyLanguage(i18n.language as LanguageChoice);

export default i18n;
