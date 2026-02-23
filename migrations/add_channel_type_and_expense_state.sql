-- ============================================================================
-- ADD channel_type TO PROJECTS, expense state to profiles, manager_id
-- ============================================================================
-- Run this in Supabase SQL Editor after add_onboarding_fields

-- Projects: add channel_type and manager_id for Group vs Direct mode
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS channel_type TEXT DEFAULT 'direct' CHECK (channel_type IN ('direct', 'group')),
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN projects.channel_type IS 'WhatsApp mode: direct (1-on-1) or group (transparency mode)';
COMMENT ON COLUMN projects.manager_id IS 'In group mode: only this profile''s messages are processed; owner can dispute';

CREATE INDEX IF NOT EXISTS idx_projects_channel_type ON projects(channel_type);
CREATE INDEX IF NOT EXISTS idx_projects_manager_id ON projects(manager_id);

-- Profiles: add expense state for awaiting_price and awaiting_confirmation
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS expense_state TEXT,
  ADD COLUMN IF NOT EXISTS expense_pending_data JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN profiles.expense_state IS 'Post-onboarding expense flow: null, awaiting_price, awaiting_confirmation';
COMMENT ON COLUMN profiles.expense_pending_data IS 'Pending item data for awaiting_price/awaiting_confirmation';

CREATE INDEX IF NOT EXISTS idx_profiles_expense_state ON profiles(expense_state) 
  WHERE expense_state IS NOT NULL;
