-- plaid-item-health-migration.sql
-- Adds Plaid item health tracking so the Accounts page can show "Needs Reconnect"
-- instead of silently sitting on stale/failed connections (e.g. Venmo stuck in
-- Plaid's "Retrying" extraction state with no user-facing signal).
-- Idempotent — safe to re-run.

ALTER TABLE plaid_connections
    ADD COLUMN IF NOT EXISTS needs_reauth boolean NOT NULL DEFAULT false;

ALTER TABLE plaid_connections
    ADD COLUMN IF NOT EXISTS last_item_error text;
