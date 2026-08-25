import { Appearance } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_BASE_CURRENCY } from '@constants/currencies';
import { SETTINGS_DEFAULTS, type ThemeChoice } from '@constants/settings';
import { applyLanguage, getSystemLanguage, type LanguageChoice } from '@i18n';
import { mmkvStorage } from '@storage/zustandMmkv';
import { type BudgetPlan, defaultBudgetPlan } from '@utils/budget';

export type ResolvedScheme = 'light' | 'dark';

const systemScheme = (): ResolvedScheme =>
  (Appearance.getColorScheme() as ResolvedScheme | null) ?? 'light';

const resolve = (theme: ThemeChoice): ResolvedScheme =>
  theme === 'system' ? systemScheme() : theme;

/**
 * User settings, mirrored to MMKV (docs/DATA_MODEL.md#mmkv--ключи-настроек).
 * Everything here is derivable/re-enterable — losing MMKV never loses data.
 *
 * Theme follows the Bsuir pattern: `resolvedScheme` is kept in the store and in
 * lock-step with the native `Appearance` override, so the JS palette and native
 * UI flip atomically without a flash (usePalette reads resolvedScheme, not
 * useColorScheme).
 */
interface SettingsState {
  baseCurrency: string;
  /**
   * Planned spend for a calendar week/month. Drives "можно сегодня" = plan ÷
   * days-in-period. A standalone budget: incomes/expenses never change it.
   */
  budgetPlan: BudgetPlan;
  /** True once the onboarding card has been completed or skipped (B11). */
  onboardingDone: boolean;
  theme: ThemeChoice;
  resolvedScheme: ResolvedScheme;
  /** UI language (RU / EN). Drives i18n + money/date formatting. */
  language: LanguageChoice;
  hideAmounts: boolean;
  inputSiri: boolean;
  inputEveningPush: boolean;
  /** Evening reminder time as 'HH:MM' (24h). Drives the daily local push (etap 8). */
  eveningPushTime: string;
  /** Last account used in the input sheet — the default next time. */
  lastAccountId: string | null;

  setBaseCurrency(c: string): void;
  setBudgetPlan(p: BudgetPlan): void;
  completeOnboarding(): void;
  setTheme(t: ThemeChoice): void;
  setLanguage(l: LanguageChoice): void;
  setHideAmounts(v: boolean): void;
  setInputSiri(v: boolean): void;
  setInputEveningPush(v: boolean): void;
  setEveningPushTime(t: string): void;
  setLastAccountId(id: string | null): void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      baseCurrency: DEFAULT_BASE_CURRENCY,
      budgetPlan: defaultBudgetPlan(DEFAULT_BASE_CURRENCY),
      onboardingDone: false,
      theme: SETTINGS_DEFAULTS.theme,
      resolvedScheme: resolve(SETTINGS_DEFAULTS.theme),
      language: getSystemLanguage(),
      hideAmounts: SETTINGS_DEFAULTS.hideAmounts,
      inputSiri: SETTINGS_DEFAULTS.inputSiri,
      inputEveningPush: SETTINGS_DEFAULTS.inputEveningPush,
      eveningPushTime: SETTINGS_DEFAULTS.eveningPushTime,
      lastAccountId: null,

      setBaseCurrency: (baseCurrency) => set({ baseCurrency }),
      setBudgetPlan: (budgetPlan) => set({ budgetPlan }),
      completeOnboarding: () => set({ onboardingDone: true }),
      setTheme: (theme) => {
        if (theme === 'system') {
          Appearance.setColorScheme(null);
          set({ theme, resolvedScheme: systemScheme() });
        } else {
          set({ theme, resolvedScheme: theme });
          // Defer the native flip so traitCollectionDidChange fires after the
          // bridge has delivered the new JS props.
          setTimeout(() => Appearance.setColorScheme(theme), 150);
        }
      },
      setLanguage: (language) => {
        applyLanguage(language);
        set({ language });
      },
      setHideAmounts: (hideAmounts) => set({ hideAmounts }),
      setInputSiri: (inputSiri) => set({ inputSiri }),
      setInputEveningPush: (inputEveningPush) => set({ inputEveningPush }),
      setEveningPushTime: (eveningPushTime) => set({ eveningPushTime }),
      setLastAccountId: (lastAccountId) => set({ lastAccountId }),
    }),
    {
      name: 'settings-v1',
      storage: createJSONStorage(() => mmkvStorage),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Sync i18n + money/date formatting with the persisted language (safe:
        // no native calls, unlike the theme's Appearance flip below).
        applyLanguage(state.language);
        // Reconcile only the JS-side resolved scheme here. Do NOT touch the
        // native `Appearance` during rehydration: this runs at module-init time,
        // before the root view is attached, and an early setColorScheme can
        // deadlock the first commit on the New Architecture — the app hangs on
        // the splash until an external trait-collection change (a system
        // dark/light toggle) kicks it loose. The native flip is applied once
        // after mount instead (see useAppBootstrap), mirroring the deferral the
        // `setTheme` action already uses.
        const r = state.theme === 'system' ? systemScheme() : state.theme;
        if (state.resolvedScheme !== r) useSettingsStore.setState({ resolvedScheme: r });
      },
    },
  ),
);

/** Resolves once settings have rehydrated from MMKV. Safe to call repeatedly. */
export const waitForSettingsHydration = (): Promise<void> => {
  if (useSettingsStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useSettingsStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
};
