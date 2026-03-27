-- ═══════════════════════════════════════════════════════════════════════════
-- Supabase Security Lint Fixes
-- Generated: 2026-03-27
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- READ BEFORE RUNNING:
--   SECTION 1 — Safe to run immediately (enables RLS that was already written)
--   SECTION 2 — Safe to run (backend-only tables, service_role bypasses RLS)
--   SECTION 3 — Safe to run (mileage_rates - expense tracker shared table)
--   SECTION 4 — Safe to run (function search_path hardening)
--   SECTION 5 — Auth setting (must be done in Supabase Dashboard UI, not SQL)
--   SECTION 6 — REVIEW FIRST: SECURITY DEFINER views (commented out by default)
--   SECTION 7 — REVIEW FIRST: rls_policy_always_true (may be intentional)
--   SECTION 8 — INFO: tables with RLS enabled but no policies (currently blocks all)
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — Enable RLS on SaaS tables that already have policies written
--             (policies exist but are inactive because RLS is off)
--             These are the ERROR: policy_exists_rls_disabled items.
--             Enabling RLS here activates the policies that are ALREADY there.
--             This will NOT break anything — it enforces what you already intended.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.beta_codes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intel_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_context     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_traders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trader_calls       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — Backend/system tables with no RLS and no policies
--             These are only written to by your backend workers/bots using the
--             service_role key, which bypasses RLS entirely.
--             Enabling RLS here locks out anonymous/authenticated direct access
--             while keeping all server-side writes working perfectly.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.discord_alerts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_messages_raw            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_regime_snapshots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_recommendation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_module_snapshots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_channels                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symbol_health_snapshots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symbol_quotes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trader_live_alignment           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_links                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_trades                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_symbols                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_activity             ENABLE ROW LEVEL SECURITY;

-- Add authenticated READ access to any of these that your frontend queries directly.
-- If a table is ONLY touched by your backend worker, leave it with no policy (blocks client access).
-- Example: if universe_symbols is shown in the SaaS UI, uncomment:
-- CREATE POLICY "authenticated read universe_symbols"
--     ON public.universe_symbols FOR SELECT TO authenticated USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — mileage_rates (Expense Tracker table)
--             Shared IRS rate table — all authenticated users can read,
--             only backend (service_role) can write.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.mileage_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read mileage rates"
    ON public.mileage_rates FOR SELECT
    TO authenticated
    USING (true);

-- Writes go through the Express API with service_role key — no INSERT/UPDATE
-- policy needed for client-side (service_role bypasses RLS).


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4 — Function search_path hardening
--             Fixes WARN: function_search_path_mutable
--             Locks each function to the public schema so a malicious user
--             cannot shadow built-in functions via search_path manipulation.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.set_updated_at()
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_updated_at_column()
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.handle_new_user()
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.sync_trader_calls_ticker()
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.set_updated_at_universe_symbols()
    SET search_path = public, pg_catalog;

ALTER FUNCTION public.set_updated_at_trader_live_alignment()
    SET search_path = public, pg_catalog;

-- tc_reserve_api_budget and tc_claim_signal_dedupe take arguments — find the exact
-- signature in Dashboard → Database → Functions, then run the matching ALTER below.
-- Common patterns (uncomment whichever matches):

-- ALTER FUNCTION public.tc_reserve_api_budget(uuid, integer)
--     SET search_path = public, pg_catalog;

-- ALTER FUNCTION public.tc_reserve_api_budget(text, integer, integer)
--     SET search_path = public, pg_catalog;

-- ALTER FUNCTION public.tc_claim_signal_dedupe(uuid, text)
--     SET search_path = public, pg_catalog;

-- ALTER FUNCTION public.tc_claim_signal_dedupe(text, text, timestamptz)
--     SET search_path = public, pg_catalog;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5 — Leaked password protection (HaveIBeenPwned check)
--             CANNOT be done via SQL. Do this in the Supabase Dashboard:
--             Authentication → Providers → Email → Enable "Leaked Password Protection"
-- ─────────────────────────────────────────────────────────────────────────────

-- (No SQL needed — dashboard UI setting only)


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6 — SECURITY DEFINER views  *** REVIEW BEFORE RUNNING ***
--             These views currently run as the view creator, bypassing RLS on
--             the underlying tables. Supabase flags this because it means ANY
--             authenticated user querying the view sees ALL rows regardless of
--             their own RLS policies.
--
--             If these views intentionally aggregate data across all users
--             (e.g. a trader scorecard that shows all traders, not just yours),
--             then SECURITY DEFINER is actually correct. DO NOT change those.
--
--             If a view should only show the querying user's data, switch to
--             SECURITY INVOKER and ensure the underlying table has a matching
--             SELECT policy. The fix would be to recreate the view like:
--
--             CREATE OR REPLACE VIEW public.v_example
--                 WITH (security_invoker = true) AS
--                 SELECT ... (original view query here) ...;
--
--             Affected views — examine each in the Dashboard before changing:
--               public.v_signal_triage
--               public.v_market_context
--               public.v_universe_health_latest
--               public.v_signal_intel_assessment
--               public.v_trader_scorecard
--               public.v_signal_filter_impact
--               public.v_setup_performance
--               public.v_trader_live_alignment
--
--             ACTION REQUIRED: Review each view. If it's an aggregated/shared
--             view (fine for all users to see), leave it. If it contains
--             per-user data, recreate with security_invoker = true.
-- ─────────────────────────────────────────────────────────────────────────────

-- Uncomment and fill in the original SELECT for any view that should be per-user:
-- CREATE OR REPLACE VIEW public.v_signal_triage
--     WITH (security_invoker = true) AS
--     SELECT ... ;  -- paste original view body from Dashboard → Table Editor → Views


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7 — rls_policy_always_true on signal_reviews and trader_watchlist_links
--             WARN: Any authenticated user can INSERT/UPDATE/DELETE ANY row.
--             This may be intentional (shared signal review system) or a bug.
--
--             If these are SHARED tables (all analysts see all reviews):
--             → The current USING (true) is intentional. Suppress the warning
--               by acknowledging it in your docs. No SQL change needed.
--
--             If these should be per-user (each user only edits their own rows):
--             → Replace the policies with user-scoped versions below.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- Example fix IF signal_reviews should be per-user (only if you want this):
-- DROP POLICY IF EXISTS "allow authenticated delete signal_reviews" ON public.signal_reviews;
-- DROP POLICY IF EXISTS "allow authenticated insert signal_reviews" ON public.signal_reviews;
-- DROP POLICY IF EXISTS "allow authenticated update signal_reviews" ON public.signal_reviews;
-- DROP POLICY IF EXISTS "authenticated write signal_reviews" ON public.signal_reviews;
-- CREATE POLICY "Users manage own signal_reviews"
--     ON public.signal_reviews FOR ALL TO authenticated
--     USING (auth.uid() = user_id)
--     WITH CHECK (auth.uid() = user_id);

-- Example fix IF trader_watchlist_links should be per-user:
-- DROP POLICY IF EXISTS "allow authenticated delete trader_watchlist_links" ON public.trader_watchlist_links;
-- DROP POLICY IF EXISTS "allow authenticated insert trader_watchlist_links" ON public.trader_watchlist_links;
-- DROP POLICY IF EXISTS "allow authenticated update trader_watchlist_links" ON public.trader_watchlist_links;
-- CREATE POLICY "Users manage own watchlist links"
--     ON public.trader_watchlist_links FOR ALL TO authenticated
--     USING (auth.uid() = user_id)
--     WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8 — INFO: rls_enabled_no_policy (RLS on, but zero policies = blocked)
--             public.api_rate_buckets and public.signal_dedupe have RLS enabled
--             but no policies. This means NO client can read or write them.
--             If these are backend-only (service_role), this is correct.
--             If the frontend needs access, add a policy:
-- ─────────────────────────────────────────────────────────────────────────────

-- Uncomment if api_rate_buckets needs client read access:
-- CREATE POLICY "authenticated read api_rate_buckets"
--     ON public.api_rate_buckets FOR SELECT TO authenticated USING (true);

-- Uncomment if signal_dedupe needs client read access:
-- CREATE POLICY "authenticated read signal_dedupe"
--     ON public.signal_dedupe FOR SELECT TO authenticated USING (true);
