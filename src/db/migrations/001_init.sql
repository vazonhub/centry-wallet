-- Centry schema v1. See docs/DATA_MODEL.md for rationale.
-- Money is stored as INTEGER minor units; the exchange rate as INTEGER ×1e6.
-- Deletes are soft (deleted_at); accounts are archived (archived_at).

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                          -- 'schema_version' -> '1'
);

CREATE TABLE accounts (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  currency      TEXT NOT NULL,                 -- ISO-4217: BYN, USD, EUR, ...
  kind          TEXT NOT NULL,                 -- card | cash | wallet
  icon          TEXT,
  opening_minor INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_default    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  archived_at   INTEGER
);

CREATE TABLE categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  icon       TEXT NOT NULL,
  color      TEXT NOT NULL,
  kind       TEXT NOT NULL,                    -- expense | income
  is_system  INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE transactions (
  id               TEXT PRIMARY KEY,
  account_id       TEXT NOT NULL REFERENCES accounts(id),
  category_id      TEXT REFERENCES categories(id),
  kind             TEXT NOT NULL,              -- expense | income | transfer
  amount_minor     INTEGER NOT NULL,          -- expense negative, income positive
  currency         TEXT NOT NULL,
  rate_to_base_e6  INTEGER NOT NULL,          -- rate x 1_000_000, frozen at write time
  note             TEXT,
  occurred_at      INTEGER NOT NULL,          -- epoch seconds UTC
  local_day        TEXT NOT NULL,             -- 'YYYY-MM-DD' in local zone at write time
  transfer_pair_id TEXT,
  author_id        TEXT NOT NULL DEFAULT 'me',
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  deleted_at       INTEGER
);

CREATE INDEX idx_tx_day      ON transactions(local_day DESC);
CREATE INDEX idx_tx_account  ON transactions(account_id);
CREATE INDEX idx_tx_category ON transactions(category_id);
