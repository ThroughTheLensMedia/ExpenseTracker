-- 010_gate_trial_on_email_confirmation.sql
-- Only grant the automatic 30-day free_beta trial once a user's email is
-- actually confirmed. Previously handle_new_user() fired on every signup
-- unconditionally, and user_subscriptions' column defaults (plan_type =
-- 'free_beta', status = 'active') meant ANY signup — confirmed or not — got
-- a fully working account instantly. Confirmed 2026-07-01: unconfirmed
-- scripted signups (shunt_*@gptmail.ca pattern) were getting full active
-- accounts with zero verification.
--
-- OAuth signups (Google, etc.) arrive with email_confirmed_at already set,
-- so the existing AFTER INSERT trigger still grants immediately for them.
-- Email/password signups have email_confirmed_at = NULL at INSERT time and
-- only get it set via UPDATE when they click the confirmation link — the
-- new AFTER UPDATE trigger below catches that case.
--
-- Idempotent — safe to re-run.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, email, expires_at)
    VALUES (NEW.id, NEW.email, NOW() + INTERVAL '30 days')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();
