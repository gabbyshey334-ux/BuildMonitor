-- ============================================================================
-- ADD active_project_id and active_project_set_at to profiles
-- For WhatsApp multi-project selection flow (ask which project each day)
-- ============================================================================
-- Run this in the Supabase SQL Editor.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active_project_id UUID
  REFERENCES projects(id);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active_project_set_at
  TIMESTAMPTZ;

COMMENT ON COLUMN profiles.active_project_id IS 'Currently selected project for WhatsApp updates (resets daily for multi-project users)';
COMMENT ON COLUMN profiles.active_project_set_at IS 'When active_project_id was last set; used to re-prompt project selection each day';

-- expense_state already exists; new value 'awaiting_project_selection' is used by the webhook
-- No schema change needed for that; it is just a new allowed value in application code.
