-- user-daily-activity-rls-fix.sql
-- Annual RLS re-audit (2026-07-01) found `user_daily_activity` had two
-- permissive RLS policies, OR'd together per Postgres RLS semantics:
--   "User ownership isolation"   — qual: auth.uid() = user_id   (correct)
--   "Service role full access"   — qual: true                  (wrong)
-- The second policy's name implies a service-role check, but RLS qual
-- clauses don't inspect the calling role — "true" applies to ANY caller,
-- including the anon/user-JWT client. It was also redundant even for its
-- intended purpose: Supabase's service_role has BYPASSRLS at the role
-- level, so it never needed a policy to bypass RLS in the first place.
--
-- Current exploitability was zero — every existing call site (activity.js,
-- cron.js, admin.js) already uses the service-role client, which ignores
-- RLS regardless of policy content. But any future route querying this
-- table with req.sb (the anon client) would have been able to read/write
-- every user's activity data, not just their own.
--
-- Idempotent — safe to re-run.

DROP POLICY IF EXISTS "Service role full access" ON public.user_daily_activity;
