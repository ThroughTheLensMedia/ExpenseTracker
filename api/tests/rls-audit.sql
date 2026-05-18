-- Lumière Ledger — RLS Multi-Tenant Audit
-- Run these queries in the Supabase SQL Editor (Dashboard → SQL Editor)
-- Each block is independent — run them in order.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. WHICH TABLES HAVE ROW LEVEL SECURITY ENABLED?
--    All user-data tables must show rowsecurity = true.
--    Infrastructure tables (user_roles, profiles) should also be true.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
    tablename,
    rowsecurity AS rls_enabled,
    CASE WHEN rowsecurity THEN '✅ Protected' ELSE '❌ EXPOSED — enable RLS immediately' END AS status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename ASC;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. WHAT POLICIES EXIST ON EACH TABLE?
--    Every user-data table needs at minimum:
--      SELECT: user_id = auth.uid()
--      INSERT: user_id = auth.uid()
--      UPDATE: user_id = auth.uid()
--      DELETE: user_id = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd       AS operation,
    qual      AS using_expr,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABLES WITH RLS ON BUT ZERO POLICIES (fully blocked — nobody can read/write)
--    These tables will silently fail for all users. Fix by adding policies.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT t.tablename, '⚠️  RLS enabled but NO policies — table is fully locked' AS warning
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = t.tablename
  )
ORDER BY t.tablename;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. USER-DATA TABLES MISSING A user_id COLUMN
--    Any table that stores per-user data but lacks user_id cannot enforce RLS.
--    These need a user_id UUID column referencing auth.users added.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT t.tablename,
       '❌ No user_id column — RLS cannot enforce ownership' AS warning
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename NOT IN ('user_roles', 'profiles', 'beta_codes')  -- infrastructure tables
  AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name   = t.tablename
        AND c.column_name  = 'user_id'
  )
ORDER BY t.tablename;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CROSS-USER ISOLATION SPOT CHECK
--    Pick two distinct user_ids from expenses and confirm their rows don't overlap.
--    Expected: each user sees only their own rows.
--    Run as service role (this editor uses service role by default).
-- ─────────────────────────────────────────────────────────────────────────────

-- List distinct users who have expenses (sanity check):
SELECT user_id, COUNT(*) AS expense_count
FROM public.expenses
GROUP BY user_id
ORDER BY expense_count DESC
LIMIT 10;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. CONFIRM user_roles IS SERVICE-ROLE-ONLY
--    The user_roles table should NOT have a policy that lets users read their own role.
--    Only the service role client should access it (used by requireRole() on the server).
--    If a SELECT policy exists for 'authenticated' on user_roles, that's acceptable
--    ONLY if it restricts to their own row. A wildcard SELECT policy is a problem.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'user_roles';

-- Expected: no policies (relying on service role only), OR a narrow
-- SELECT policy like: (auth.uid() = user_id) with roles = '{authenticated}'
-- NOT acceptable: qual = 'true' (unrestricted read)


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. WHAT TO DO WITH RESULTS
--
-- ✅ All clear if:
--   - Every user-data table shows rowsecurity = true  (Query 1)
--   - Every table has SELECT/INSERT/UPDATE/DELETE policies  (Query 2)
--   - Query 3 returns 0 rows
--   - Query 4 returns 0 rows
--   - Query 5 shows no user_id appearing in another user's bucket
--   - Query 6 shows no wildcard SELECT policy on user_roles
--
-- ❌ Fix immediately if:
--   - Any user-data table has rowsecurity = false → Supabase dashboard → table → RLS → Enable
--   - Query 3 returns rows → add policies for that table
--   - Query 4 returns rows → add user_id column and policies
--   - Query 6 shows qual = 'true' → drop that policy, restrict to service role only
-- ─────────────────────────────────────────────────────────────────────────────
