import 'i18next';

import type { Translations } from './ru';

/**
 * Types `t('…')` against the RU dictionary shape, so a missing or misspelled key
 * is a compile error (not a silent key echoed at runtime). `en.ts` is already
 * typed as `Translations`, so both languages stay in lock-step.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Translations };
  }
}
