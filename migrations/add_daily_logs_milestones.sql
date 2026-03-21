-- Daily Site Journal fields for Daily Accountability
ALTER TABLE public.daily_logs ADD COLUMN IF NOT EXISTS milestones text;
ALTER TABLE public.daily_logs ADD COLUMN IF NOT EXISTS milestone_count integer DEFAULT 0;

COMMENT ON COLUMN public.daily_logs.milestones IS 'Today''s milestones / journal description';
COMMENT ON COLUMN public.daily_logs.milestone_count IS 'Number of milestones covered';
