-- Add activity_entries to daily_logs for timeline/milestone logging
-- Each entry: { log_time, activity_type, description, amount? }
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS activity_entries JSONB DEFAULT '[]';
