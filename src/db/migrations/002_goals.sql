-- Centry schema v2 — savings goals (цели).
-- A goal is a special account (kind = 'goal'): money reaches it via a transfer
-- (never counted as spending), it is always excluded from the daily allowance
-- and spend statistics, and its balance is still part of total money. These
-- columns are NULL for ordinary accounts.

ALTER TABLE accounts ADD COLUMN target_minor INTEGER;  -- goal target (minor units of currency)
ALTER TABLE accounts ADD COLUMN color        TEXT;     -- accent hex for the goal's progress ring
ALTER TABLE accounts ADD COLUMN closed_at    INTEGER;  -- when the goal was closed (achieved/purchased)
