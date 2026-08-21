import * as SQLite from 'expo-sqlite';

/**
 * SQLite is the single source of truth (docs/ARCHITECTURE.md). This module owns
 * the one connection; every SQL statement in the app lives under `src/db`
 * (the offline analogue of Bsuir Time's "axios only in api/" rule).
 */
const DB_NAME = 'centry.db';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the shared database handle, opening it on first use.
 *
 * PRAGMAs:
 * - `journal_mode = WAL` — concurrent reads while writing (persisted in the file);
 * - `foreign_keys = ON`  — enforce the account/category references (per-connection).
 */
export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
    db.execSync('PRAGMA journal_mode = WAL;');
    db.execSync('PRAGMA foreign_keys = ON;');
  }
  return db;
}

/** Test/reset helper — drops the cached handle so the next getDb() reopens. */
export function _resetConnectionForTests(): void {
  db = null;
}
