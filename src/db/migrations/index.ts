import { getDb } from '../connection';

// Raw SQL is inlined as a string at build time (babel-plugin-inline-import).
import initSql from './001_init.sql';
import goalsSql from './002_goals.sql';

interface Migration {
  version: number;
  name: string;
  sql: string;
}

/**
 * Ordered migration list. The mechanism ships on v1 even with a single
 * migration — it is the foundation for every future schema change
 * (docs/DATA_MODEL.md#миграции). Add new files as `NNN_name.sql` + an entry.
 */
const MIGRATIONS: Migration[] = [
  { version: 1, name: '001_init', sql: initSql },
  { version: 2, name: '002_goals', sql: goalsSql },
];

const LATEST_VERSION = MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);

/** Reads the applied schema version from `meta`, 0 if not initialised yet. */
async function readSchemaVersion(): Promise<number> {
  const db = getDb();
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  );
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM meta WHERE key = 'schema_version';`,
  );
  return row ? parseInt(row.value, 10) : 0;
}

/**
 * Runs all pending migrations in ascending order, each inside a transaction so
 * a failure leaves the schema version untouched. Idempotent: already-applied
 * migrations are skipped.
 */
export async function runMigrations(): Promise<void> {
  const db = getDb();
  const current = await readSchemaVersion();
  const pending = MIGRATIONS.filter((m) => m.version > current).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      await db.runAsync(
        `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
        [String(migration.version)],
      );
    });
  }
}

/** The schema version this build expects after migrations complete. */
export const EXPECTED_SCHEMA_VERSION = LATEST_VERSION;
