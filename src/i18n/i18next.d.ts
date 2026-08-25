import 'i18next';

import type { Translations } from './en';

/**
 * Types `t('…')` against the EN dictionary shape (the base language), so a missing
 * or misspelled key is a compile error (not a silent key echoed at runtime).
 * `ru.ts` is typed as `Translations`, so both languages stay in lock-step.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Translations };
  }
}
