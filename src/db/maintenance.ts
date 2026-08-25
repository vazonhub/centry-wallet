import { getDb } from './connection';

/**
 * Hard-deletes ALL rows — the single user-initiated exception to the soft-delete
 * rule, used only by "Удалить все данные" in settings. Order respects the
 * foreign keys (transactions reference accounts/categories).
 */
export async function wipeAllData(): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM transactions; DELETE FROM categories; DELETE FROM accounts;');
  });
}
