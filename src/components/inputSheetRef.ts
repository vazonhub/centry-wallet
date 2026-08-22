import { createRef } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import type { TransactionKind } from '@models';

/**
 * Module-level ref to the single global input sheet, rendered once at the app
 * root. Any screen opens it by calling `openInputSheet()` — a direct
 * `present()` on the ref, with no store/effect indirection (which previously
 * made the "+" appear dead).
 */
export const inputSheetRef = createRef<BottomSheetModal>();

/**
 * Optional prefill applied the next time the sheet opens — the bridge for the
 * Siri App Intent (etap 8): "добавь трату 12 еда" opens the app and hands the
 * parsed amount/note to the sheet. `amount` is the raw text for the amount
 * field (formatted in the selected account's currency at input time).
 */
export interface InputPrefill {
  kind?: TransactionKind;
  amount?: string;
  note?: string;
}

let pendingPrefill: InputPrefill | null = null;

/**
 * Opens the input sheet, optionally seeding the form (Siri/App Intent path).
 *
 * On a cold start via the widget deep link the ref can still be null when the
 * launch URL resolves (the sheet mounts a tick later), so we retry a few frames
 * instead of silently no-opping — otherwise tapping the widget opens the app but
 * never shows the sheet.
 */
export function openInputSheet(prefill?: InputPrefill): void {
  pendingPrefill = prefill ?? null;
  let attempts = 0;
  const tryPresent = (): void => {
    if (inputSheetRef.current) {
      inputSheetRef.current.present();
      return;
    }
    if (attempts++ < 30) {
      requestAnimationFrame(tryPresent);
      return;
    }
    console.warn('[input] sheet ref not ready');
  };
  tryPresent();
}

/** Reads and clears the pending prefill — called once by the sheet on open. */
export function consumeInputPrefill(): InputPrefill | null {
  const p = pendingPrefill;
  pendingPrefill = null;
  return p;
}
