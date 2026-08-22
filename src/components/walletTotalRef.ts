import { createRef } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

/**
 * Module-level ref to the single global wallet-total sheet, rendered once at the
 * app root. Opened from the Home total block via {@link openWalletTotal}.
 */
export const walletTotalRef = createRef<BottomSheetModal>();

/** Opens the wallet-total sheet, retrying a few frames if the ref isn't ready. */
export function openWalletTotal(): void {
  let attempts = 0;
  const tryPresent = (): void => {
    if (walletTotalRef.current) {
      walletTotalRef.current.present();
      return;
    }
    if (attempts++ < 30) {
      requestAnimationFrame(tryPresent);
      return;
    }
    console.warn('[wallet-total] sheet ref not ready');
  };
  tryPresent();
}
