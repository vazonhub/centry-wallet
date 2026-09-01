import { createRef } from 'react';

/** Chart flow filter — all balance / income only / expense only. */
export type WalletFlow = 'all' | 'income' | 'expense';
/** Chart granularity — one bar per day / one bar per transaction. */
export type WalletChartMode = 'byDay' | 'byTx';

export interface WalletTotalPreset {
  flow?: WalletFlow;
  mode?: WalletChartMode;
}

export interface WalletTotalHandle {
  /** Opens the sheet, optionally preselecting the flow filter and granularity. */
  open(preset?: WalletTotalPreset): void;
}

/**
 * Module-level handle to the single global wallet-total sheet, rendered once at
 * the app root. Opened from the Home total block and the History totals via
 * {@link openWalletTotal}.
 */
export const walletTotalRef = createRef<WalletTotalHandle>();

/** Opens the wallet-total sheet, retrying a few frames if the ref isn't ready. */
export function openWalletTotal(preset?: WalletTotalPreset): void {
  let attempts = 0;
  const tryOpen = (): void => {
    if (walletTotalRef.current) {
      walletTotalRef.current.open(preset);
      return;
    }
    if (attempts++ < 30) {
      requestAnimationFrame(tryOpen);
      return;
    }
    console.warn('[wallet-total] sheet ref not ready');
  };
  tryOpen();
}
