-- ═══════════════════════════════════════════════════════════════════════════
-- Supabase Security Lint Fixes
-- Generated: 2026-03-27
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This script is fully idempotent — safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — Enable RLS on SaaS tables that already have policies written
--             Policies exist but are inactive because RLS is off.
--             ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent.
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
-- SECTION 2 — Backend/system tables (no RLS, no policies)
--             Service_role key bypasses RLS — server-side writes unaffected.
--             Enabling RLS blocks anonymous/authenticated direct client access.
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


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — mileage_rates (Expense Tracker shared IRS rate table)
--             All authenticated users can read; only service_role writes.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.mileage_rates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'mileage_rates'
          AND policyname = 'Authenticated users can read mileage rates'
    ) THEN
        CREATE POLICY "Authenticated users can read mileage rates"
            ON public.mileage_rates FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4 — Function search_path hardening (WARN: function_search_path_mutable)
--
--             Uses pg_proc to auto-discover the full signature (including all
--             argument types) for every listed function, then runs ALTER FUNCTION
--             with the exact signature Postgres requires.
--             Handles overloads, zero-arg functions, and any argument types.
--             Safe to re-run — SET search_path is idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oid::regprocedure AS func_sig
        FROM pg_proc
        WHERE pronamespace = 'public'::regnamespace
          AND proname IN (
              'set_updated_at',
              'update_updated_at_column',
              'handle_new_user',
              'sync_trader_calls_ticker',
              'set_updated_at_universe_symbols',
              'set_updated_at_trader_live_alignment',
              'tc_reserve_api_budget',
              'tc_claim_signal_dedupe'
          )
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %s SET search_path = public, pg_catalog',
            r.func_sig
        );
        RAISE NOTICE 'Hardened search_path on: %', r.func_sig;
    END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5 — Leaked password protection
--             Must be done in the Supabase Dashboard (not SQL):
--             Authentication → Providers → Email → Enable "Leaked Password Protection"
-- ─────────────────────────────────────────────────────────────────────────────

-- (Dashboard UI only — no SQL available)


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6 — SECURITY DEFINER views  *** REVIEW BEFORE RUNNING ***
--
--             Your 8 v_* views run as the view creator, bypassing underlying RLS.
--             For shared trading/signal aggregation views this is intentional.
--             Only change to SECURITY INVOKER if a view should show per-user data.
--
--             Affected: v_signal_triage, v_market_context, v_universe_health_latest,
--             v_signal_intel_assessment, v_trader_scorecard, v_signal_filter_impact,
--             v_setup_performance, v_trader_live_alignment
--
--             To fix a specific view, recreate it with security_invoker = true:
--             CREATE OR REPLACE VIEW public.v_example
--                 WITH (security_invoker = true) AS
--                 SELECT ... (paste original view body from Dashboard → Views) ...;
-- ─────────────────────────────────────────────────────────────────────────────

-- (Commented out — review each view first)


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7 — rls_policy_always_true on signal_reviews / trader_watchlist_links
--
--             Any authenticated user can mutate any row (USING (true)).
--             If this is a shared analyst system → intentional, no change needed.
--             If rows should be per-user → uncomment below to scope by user_id.
-- ─────────────────────────────────────────────────────────────────────────────

-- Per-user fix for signal_reviews (only if NOT a shared system):
-- DROP POLICY IF EXISTS "allow authenticated delete signal_reviews" ON public.signal_reviews;
-- DROP POLICY IF EXISTS "allow authenticated insert signal_reviews" ON public.signal_reviews;
-- DROP POLICY IF EXISTS "allow authenticated update signal_reviews" ON public.signal_reviews;
-- DROP POLICY IF EXISTS "authenticated write signal_reviews"        ON public.signal_reviews;
-- CREATE POLICY "Users manage own signal_reviews"
--     ON public.signal_reviews FOR ALL TO authenticated
--     USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Per-user fix for trader_watchlist_links (only if NOT a shared system):
-- DROP POLICY IF EXISTS "allow authenticated delete trader_watchlist_links" ON public.trader_watchlist_links;
-- DROP POLICY IF EXISTS "allow authenticated insert trader_watchlist_links" ON public.trader_watchlist_links;
-- DROP POLICY IF EXISTS "allow authenticated update trader_watchlist_links" ON public.trader_watchlist_links;
-- CREATE POLICY "Users manage own watchlist links"
--     ON public.trader_watchlist_links FOR ALL TO authenticated
--     USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8 — INFO: api_rate_buckets and signal_dedupe
--             RLS is enabled but no policies exist → all client access blocked.
--             Service_role (backend) still works fine.
--             Uncomment below only if the frontend needs to read these tables.
-- ─────────────────────────────────────────────────────────────────────────────

-- CREATE POLICY "authenticated read api_rate_buckets"
--     ON public.api_rate_buckets FOR SELECT TO authenticated USING (true);

-- CREATE POLICY "authenticated read signal_dedupe"
--     ON public.signal_dedupe FOR SELECT TO authenticated USING (true);
