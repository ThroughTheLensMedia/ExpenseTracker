-- Gate 1: account-level Personal vs Business experience selection.
-- Additive and safe for existing accounts: every current row remains Business.
ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS experience_mode TEXT;

UPDATE public.settings
SET experience_mode = 'business'
WHERE experience_mode IS NULL
   OR experience_mode NOT IN ('business', 'personal');

ALTER TABLE public.settings
    ALTER COLUMN experience_mode SET DEFAULT 'business',
    ALTER COLUMN experience_mode SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'settings_experience_mode_check'
          AND conrelid = 'public.settings'::regclass
    ) THEN
        ALTER TABLE public.settings
            ADD CONSTRAINT settings_experience_mode_check
            CHECK (experience_mode IN ('business', 'personal'));
    END IF;
END
$$;
