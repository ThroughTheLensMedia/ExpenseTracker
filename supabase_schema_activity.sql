-- Activity Tracking Schema
CREATE TABLE IF NOT EXISTS user_daily_activity (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_minutes_active INTEGER NOT NULL DEFAULT 1,
  last_pulse_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one row per user per day
  UNIQUE(user_id, activity_date)
);

-- Index for admin reports
CREATE INDEX IF NOT EXISTS idx_activity_date ON user_daily_activity(activity_date);
CREATE INDEX IF NOT EXISTS idx_activity_user ON user_daily_activity(user_id);
