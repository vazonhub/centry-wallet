import { createRef } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

/**
 * Module-level ref to the single global budget-plan sheet, rendered once at the
 * app root. Opened from the Home hero via {@link openBudgetSheet} so editing the
 * plan happens in place instead of navigating into Settings (which broke the
 * back button — you'd land in Settings, not back on Home).
 */
export const budgetSheetRef = createRef<BottomSheetModal>();

/** Opens the budget sheet, retrying a few frames if the ref isn't ready yet. */
export function openBudgetSheet(): void {
  let attempts = 0;
  const tryPresent = (): void => {
    if (budgetSheetRef.current) {
      budgetSheetRef.current.present();
      return;
    }
    if (attempts++ < 30) {
      requestAnimationFrame(tryPresent);
      return;
    }
    console.warn('[budget] sheet ref not ready');
  };
  tryPresent();
}
