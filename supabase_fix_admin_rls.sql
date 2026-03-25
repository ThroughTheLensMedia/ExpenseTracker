-- ═══════════════════════════════════════════════════════
-- Fix: Disable RLS on admin-only tables
-- These tables are only accessed server-side by admin routes.
-- They do NOT need per-user RLS since the admin API already
-- validates the admin email (joshua.deuermeyer@gmail.com).
-- ═══════════════════════════════════════════════════════

-- Disable RLS on admin tables (safe: these are server-side only)
ALTER TABLE IF EXISTS beta_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_daily_activity DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;

-- Verify: These should show rls_enabled = false
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('beta_codes', 'user_subscriptions', 'user_daily_activity', 'profiles')
ORDER BY tablename;
