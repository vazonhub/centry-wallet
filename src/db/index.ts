/**
 * Public surface of the data layer. Controllers import from `@db` only —
 * never touch `expo-sqlite` or raw SQL directly (docs/ARCHITECTURE.md).
 */
export { getDb } from './connection';
export { runMigrations, EXPECTED_SCHEMA_VERSION } from './migrations';
export { wipeAllData } from './maintenance';

export * as AccountsRepo from './accounts.repo';
export * as CategoriesRepo from './categories.repo';
export * as TransactionsRepo from './transactions.repo';
