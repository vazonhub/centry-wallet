import { Appearance } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_BASE_CURRENCY } from '@constants/currencies';
import { SETTINGS_DEFAULTS, type ThemeChoice } from '@constants/settings';
import { mmkvStorage } from '@storage/zustandMmkv';
import { defaultSchedule, type PayoutSchedule, type PayoutSlotValue } from '@utils/schedule';

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
   * Recurring payout schedule (B21, generalized). Drives "можно сегодня" =
   * period payout ÷ days-in-period. Per-slot amounts live in `payoutSchedule.
   * amounts`; recording income with the "регулярная выплата" toggle updates a
   * slot.
   */
  payoutSchedule: PayoutSchedule;
  /** True once the onboarding card has been completed or skipped (B11). */
  onboardingDone: boolean;
  theme: ThemeChoice;
  resolvedScheme: ResolvedScheme;
  hideAmounts: boolean;
  inputWidget: boolean;
  inputSiri: boolean;
  inputEveningPush: boolean;
  /** Evening reminder time as 'HH:MM' (24h). Drives the daily local push (etap 8). */
  eveningPushTime: string;
  /** Last account used in the input sheet — the default next time. */
  lastAccountId: string | null;

  setBaseCurrency(c: string): void;
  setPayoutSchedule(s: PayoutSchedule): void;
  /** Sets the expected amount (in its own currency) for one payout slot. */
  setSlotAmount(slotId: string, value: PayoutSlotValue): void;
  completeOnboarding(): void;
  setTheme(t: ThemeChoice): void;
  setHideAmounts(v: boolean): void;
  setInputWidget(v: boolean): void;
  setInputSiri(v: boolean): void;
  setInputEveningPush(v: boolean): void;
  setEveningPushTime(t: string): void;
  setLastAccountId(id: string): void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      baseCurrency: DEFAULT_BASE_CURRENCY,
      payoutSchedule: defaultSchedule(),
      onboardingDone: false,
      theme: SETTINGS_DEFAULTS.theme,
      resolvedScheme: resolve(SETTINGS_DEFAULTS.theme),
      hideAmounts: SETTINGS_DEFAULTS.hideAmounts,
      inputWidget: SETTINGS_DEFAULTS.inputWidget,
      inputSiri: SETTINGS_DEFAULTS.inputSiri,
      inputEveningPush: SETTINGS_DEFAULTS.inputEveningPush,
      eveningPushTime: SETTINGS_DEFAULTS.eveningPushTime,
      lastAccountId: null,

      setBaseCurrency: (baseCurrency) => set({ baseCurrency }),
      setPayoutSchedule: (payoutSchedule) => set({ payoutSchedule }),
      setSlotAmount: (slotId, value) =>
        set((s) => ({
          payoutSchedule: {
            ...s.payoutSchedule,
            amounts: { ...s.payoutSchedule.amounts, [slotId]: value },
          },
        })),
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
      setHideAmounts: (hideAmounts) => set({ hideAmounts }),
      setInputWidget: (inputWidget) => set({ inputWidget }),
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
        if (state.theme === 'system') {
          Appearance.setColorScheme(null);
          const r = systemScheme();
          if (state.resolvedScheme !== r) useSettingsStore.setState({ resolvedScheme: r });
        } else {
          Appearance.setColorScheme(state.theme);
          if (state.resolvedScheme !== state.theme) {
            useSettingsStore.setState({ resolvedScheme: state.theme });
          }
        }
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
