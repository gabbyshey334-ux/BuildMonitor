-- ============================================================================
-- ADD ONBOARDING FIELDS TO PROFILES TABLE
-- ============================================================================
-- Adds fields to track WhatsApp onboarding state and data

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_state TEXT,
ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Onboarding states:
-- null: Not started
-- 'welcome_sent': Welcome message sent, awaiting project type
-- 'awaiting_project_type': Waiting for project type selection
-- 'awaiting_location': Waiting for location input
-- 'awaiting_start_date': Waiting for start date
-- 'awaiting_budget': Waiting for budget
-- 'confirmation': Showing confirmation, awaiting approval
-- 'completed': Onboarding completed

COMMENT ON COLUMN profiles.onboarding_state IS 'Current step in WhatsApp onboarding flow';
COMMENT ON COLUMN profiles.onboarding_data IS 'Stored onboarding responses (project_type, location, start_date, budget)';
COMMENT ON COLUMN profiles.onboarding_completed_at IS 'Timestamp when onboarding was completed';

-- Index for querying users in onboarding
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_state ON profiles(onboarding_state) 
WHERE onboarding_state IS NOT NULL;


