-- JengaTrack Production Audit - Run these in Supabase SQL Editor
-- Execute only if columns are missing (check first with information_schema queries)

-- 1. Verify tables exist:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- 2. Verify columns exist:
-- SELECT table_name, column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name IN ('profiles','projects','expenses','daily_logs','materials_inventory','vendors','tasks')
-- ORDER BY table_name, ordinal_position;

-- 3. Add missing columns (run individually if needed):

-- Profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_project_id UUID REFERENCES projects(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_project_set_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expense_state TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expense_pending_data JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'UGX';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

-- Expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS disputed BOOLEAN DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'UGX';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS quantity_logged TEXT;

-- Projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS channel_type TEXT DEFAULT 'direct';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS manager_id UUID;

-- Vendors (schema uses total_spent, total_transactions - verify names match)
-- ALTER TABLE vendors ADD COLUMN IF NOT EXISTS total_transactions INTEGER DEFAULT 0;
