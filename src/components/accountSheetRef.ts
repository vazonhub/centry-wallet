import { createRef } from 'react';

/**
 * Imperative handle to the single global account sheet, rendered once at the app
 * root. Any screen opens it via {@link openAccountSheet} — Home (tap an account
 * chip → edit, tap "＋ Счёт" → add) and the Accounts settings screen share it, so
 * the create/edit form lives in exactly one place.
 */
export interface AccountSheetHandle {
  /** Opens the sheet: pass an accountId to edit, or nothing to add a new one. */
  open(accountId?: string): void;
}

export const accountSheetRef = createRef<AccountSheetHandle>();

/**
 * Opens the account sheet. Retries a few frames if the sheet ref is not mounted
 * yet (e.g. right after a cold start) instead of silently no-opping.
 */
export function openAccountSheet(accountId?: string): void {
  let attempts = 0;
  const tryOpen = (): void => {
    if (accountSheetRef.current) {
      accountSheetRef.current.open(accountId);
      return;
    }
    if (attempts++ < 30) {
      requestAnimationFrame(tryOpen);
      return;
    }
    console.warn('[account] sheet ref not ready');
  };
  tryOpen();
}
