import type { InputPrefill } from '@components/inputSheetRef';
import type { TransactionKind } from '@models';
import { INTENT_PENDING_KEY, intentStorage } from '@storage/mmkv';

/**
 * The Siri App Intent (etap 8) runs in a separate process; it parses the phrase
 * and writes a small JSON prefill to the shared App-Group MMKV, then launches
 * the app. This module is the JS side of that bridge — it reads and clears the
 * pending record so the input sheet can open pre-seeded. No SQL, no network:
 * the actual write still funnels through the normal controller when the user
 * taps save (the single AddTransactionIntent contract, docs/UX_SPEC.md).
 */

interface PendingIntentRecord {
  kind?: string;
  amount?: number | string;
  note?: string;
}

const isKind = (v: unknown): v is TransactionKind =>
  v === 'expense' || v === 'income' || v === 'transfer';

/** Reads and clears the pending App-Intent prefill, or null if none is waiting. */
export function consumePendingIntent(): InputPrefill | null {
  const raw = intentStorage.getString(INTENT_PENDING_KEY);
  if (!raw) return null;
  intentStorage.delete(INTENT_PENDING_KEY);

  try {
    const rec = JSON.parse(raw) as PendingIntentRecord;
    const prefill: InputPrefill = {};
    if (isKind(rec.kind)) prefill.kind = rec.kind;
    if (rec.amount != null && String(rec.amount).trim()) prefill.amount = String(rec.amount).trim();
    if (rec.note && String(rec.note).trim()) prefill.note = String(rec.note).trim();
    return prefill.kind || prefill.amount || prefill.note ? prefill : null;
  } catch {
    return null;
  }
}
