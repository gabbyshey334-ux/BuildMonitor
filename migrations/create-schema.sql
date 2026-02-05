-- ============================================================================
-- CONSTRUCTION MONITOR (JengaTrack) - COMPLETE DATABASE SCHEMA
-- ============================================================================
-- This script creates a complete, production-ready database schema for
-- the WhatsApp-based construction expense tracking application.
--
-- Created: 2024
-- Database: PostgreSQL
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
-- Stores user account information
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    whatsapp_number TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS 'User accounts for the Construction Monitor application';
COMMENT ON COLUMN users.id IS 'Unique user identifier (UUID)';
COMMENT ON COLUMN users.email IS 'User email address (unique)';
COMMENT ON COLUMN users.full_name IS 'User full name';
COMMENT ON COLUMN users.whatsapp_number IS 'WhatsApp phone number in E.164 format (unique)';

-- Indexes for users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_whatsapp_number ON users(whatsapp_number);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================================================
-- 2. USER_SETTINGS TABLE
-- ============================================================================
-- Stores user preferences and settings
-- ============================================================================

CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'lg')),
    currency TEXT NOT NULL DEFAULT 'UGX',
    timezone TEXT NOT NULL DEFAULT 'Africa/Kampala',
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

COMMENT ON TABLE user_settings IS 'User preferences and application settings';
COMMENT ON COLUMN user_settings.language IS 'Preferred language: en (English) or lg (Luganda)';
COMMENT ON COLUMN user_settings.currency IS 'Preferred currency code (default: UGX)';
COMMENT ON COLUMN user_settings.timezone IS 'User timezone (default: Africa/Kampala)';

-- Indexes for user_settings
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- ============================================================================
-- 3. EXPENSE_CATEGORIES TABLE
-- ============================================================================
-- Reference table for expense categories
-- ============================================================================

CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE expense_categories IS 'Reference table for expense categories';
COMMENT ON COLUMN expense_categories.name IS 'Category name (unique)';
COMMENT ON COLUMN expense_categories.color IS 'Hex color code for UI display';

-- ============================================================================
-- 4. PROJECTS TABLE
-- ============================================================================
-- Construction projects managed by users
-- ============================================================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    budget NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (budget >= 0),
    spent NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (spent >= 0),
    currency TEXT NOT NULL DEFAULT 'UGX',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE projects IS 'Construction projects managed by users';
COMMENT ON COLUMN projects.budget IS 'Total project budget';
COMMENT ON COLUMN projects.spent IS 'Total amount spent (automatically calculated from expenses)';
COMMENT ON COLUMN projects.status IS 'Project status: active, completed, or on_hold';

-- Indexes for projects
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at);
CREATE INDEX idx_projects_user_status ON projects(user_id, status);

-- ============================================================================
-- 5. EXPENSES TABLE
-- ============================================================================
-- Individual expense records
-- ============================================================================

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    category_id UUID REFERENCES expense_categories(id),
    description TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'UGX',
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('whatsapp', 'manual', 'import')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE expenses IS 'Individual expense records';
COMMENT ON COLUMN expenses.source IS 'Source of expense: whatsapp, manual, or import';
COMMENT ON COLUMN expenses.expense_date IS 'Date when expense occurred';

-- Indexes for expenses
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_project_id ON expenses(project_id);
CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX idx_expenses_created_at ON expenses(created_at);
CREATE INDEX idx_expenses_user_project_date ON expenses(user_id, project_id, expense_date);

-- ============================================================================
-- 6. TASKS TABLE
-- ============================================================================
-- Task management for projects
-- ============================================================================

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date DATE,
    completed_at TIMESTAMPTZ,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('whatsapp', 'manual')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tasks IS 'Task management for construction projects';
COMMENT ON COLUMN tasks.status IS 'Task status: todo, in_progress, or done';
COMMENT ON COLUMN tasks.priority IS 'Task priority: low, medium, or high';
COMMENT ON COLUMN tasks.source IS 'Source of task: whatsapp or manual';

-- Indexes for tasks
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);

-- ============================================================================
-- 7. BUDGETS TABLE
-- ============================================================================
-- Budget tracking with alert thresholds
-- ============================================================================

CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    total_budget NUMERIC(15, 2) NOT NULL CHECK (total_budget >= 0),
    currency TEXT NOT NULL DEFAULT 'UGX',
    period_start DATE NOT NULL DEFAULT CURRENT_DATE,
    period_end DATE,
    alert_threshold_1 NUMERIC(5, 2) NOT NULL DEFAULT 50 CHECK (alert_threshold_1 >= 0 AND alert_threshold_1 <= 100),
    alert_threshold_2 NUMERIC(5, 2) NOT NULL DEFAULT 80 CHECK (alert_threshold_2 >= 0 AND alert_threshold_2 <= 100),
    alert_threshold_3 NUMERIC(5, 2) NOT NULL DEFAULT 100 CHECK (alert_threshold_3 >= 0 AND alert_threshold_3 <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, project_id)
);

COMMENT ON TABLE budgets IS 'Budget tracking with customizable alert thresholds';
COMMENT ON COLUMN budgets.alert_threshold_1 IS 'First alert threshold (percentage, default: 50%)';
COMMENT ON COLUMN budgets.alert_threshold_2 IS 'Second alert threshold (percentage, default: 80%)';
COMMENT ON COLUMN budgets.alert_threshold_3 IS 'Third alert threshold (percentage, default: 100%)';

-- Indexes for budgets
CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_project_id ON budgets(project_id);
CREATE INDEX idx_budgets_user_project ON budgets(user_id, project_id);

-- ============================================================================
-- 8. IMAGES TABLE
-- ============================================================================
-- Image storage metadata
-- ============================================================================

CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('whatsapp', 'upload')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE images IS 'Image storage metadata for receipts, site photos, etc.';
COMMENT ON COLUMN images.storage_path IS 'Path to image in storage (e.g., S3, Supabase Storage)';
COMMENT ON COLUMN images.source IS 'Source of image: whatsapp or upload';

-- Indexes for images
CREATE INDEX idx_images_user_id ON images(user_id);
CREATE INDEX idx_images_project_id ON images(project_id);
CREATE INDEX idx_images_expense_id ON images(expense_id);
CREATE INDEX idx_images_created_at ON images(created_at);

-- ============================================================================
-- 9. WHATSAPP_MESSAGES TABLE
-- ============================================================================
-- WhatsApp message logging and processing
-- ============================================================================

CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_body TEXT,
    message_sid TEXT UNIQUE,
    intent TEXT,
    confidence NUMERIC(5, 2),
    processed BOOLEAN NOT NULL DEFAULT false,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE whatsapp_messages IS 'WhatsApp message logging and processing';
COMMENT ON COLUMN whatsapp_messages.direction IS 'Message direction: inbound or outbound';
COMMENT ON COLUMN whatsapp_messages.intent IS 'Detected intent from NLP processing';
COMMENT ON COLUMN whatsapp_messages.confidence IS 'Confidence score for intent detection (0-100)';
COMMENT ON COLUMN whatsapp_messages.processed IS 'Whether message has been processed';

-- Indexes for whatsapp_messages
CREATE INDEX idx_whatsapp_messages_user_id ON whatsapp_messages(user_id);
CREATE INDEX idx_whatsapp_messages_phone_number ON whatsapp_messages(phone_number);
CREATE INDEX idx_whatsapp_messages_created_at ON whatsapp_messages(created_at);
CREATE INDEX idx_whatsapp_messages_processed ON whatsapp_messages(processed);
CREATE INDEX idx_whatsapp_messages_user_processed ON whatsapp_messages(user_id, processed);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS 'Trigger function to automatically update updated_at timestamp';

-- Function to automatically recalculate project.spent from expenses
CREATE OR REPLACE FUNCTION update_project_spent()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the project's spent amount
    UPDATE projects
    SET spent = COALESCE((
        SELECT SUM(amount)
        FROM expenses
        WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
        AND deleted_at IS NULL
    ), 0),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.project_id, OLD.project_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_project_spent() IS 'Trigger function to automatically recalculate project.spent from expenses';

-- Function to get user by WhatsApp number
CREATE OR REPLACE FUNCTION get_user_by_whatsapp(phone TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    whatsapp_number TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email, u.full_name, u.whatsapp_number
    FROM users u
    WHERE u.whatsapp_number = phone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_by_whatsapp(TEXT) IS 'Get user record by WhatsApp phone number (SECURITY DEFINER)';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update updated_at on users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on user_settings table
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on projects table
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on expenses table
CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on tasks table
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on budgets table
CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update project.spent when expenses change
CREATE TRIGGER update_project_spent_trigger
    AFTER INSERT OR UPDATE OR DELETE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_project_spent();

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Insert default expense categories
INSERT INTO expense_categories (name, description, color) VALUES
    ('Materials', 'Construction materials like cement, sand, bricks', '#93C54E'),
    ('Labor', 'Worker wages and contractor fees', '#218598'),
    ('Equipment', 'Tools and machinery rental', '#B4D68C'),
    ('Transport', 'Transportation and delivery costs', '#6EC1C0'),
    ('Miscellaneous', 'Other expenses', '#2F3332')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY users_select_own ON users
    FOR SELECT
    USING (id = auth.uid());

CREATE POLICY users_update_own ON users
    FOR UPDATE
    USING (id = auth.uid());

-- User settings policies
CREATE POLICY user_settings_select_own ON user_settings
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY user_settings_insert_own ON user_settings
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY user_settings_update_own ON user_settings
    FOR UPDATE
    USING (user_id = auth.uid());

-- Expense categories policies (reference data - anyone can view)
CREATE POLICY expense_categories_select_all ON expense_categories
    FOR SELECT
    USING (true);

-- Projects policies
CREATE POLICY projects_select_own ON projects
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY projects_insert_own ON projects
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY projects_update_own ON projects
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY projects_delete_own ON projects
    FOR DELETE
    USING (user_id = auth.uid());

-- Expenses policies
CREATE POLICY expenses_select_own ON expenses
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY expenses_insert_own ON expenses
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY expenses_update_own ON expenses
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY expenses_delete_own ON expenses
    FOR DELETE
    USING (user_id = auth.uid());

-- Tasks policies
CREATE POLICY tasks_select_own ON tasks
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY tasks_insert_own ON tasks
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY tasks_update_own ON tasks
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY tasks_delete_own ON tasks
    FOR DELETE
    USING (user_id = auth.uid());

-- Budgets policies
CREATE POLICY budgets_select_own ON budgets
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY budgets_insert_own ON budgets
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY budgets_update_own ON budgets
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY budgets_delete_own ON budgets
    FOR DELETE
    USING (user_id = auth.uid());

-- Images policies
CREATE POLICY images_select_own ON images
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY images_insert_own ON images
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY images_delete_own ON images
    FOR DELETE
    USING (user_id = auth.uid());

-- WhatsApp messages policies
CREATE POLICY whatsapp_messages_select_own ON whatsapp_messages
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY whatsapp_messages_insert_system ON whatsapp_messages
    FOR INSERT
    WITH CHECK (true); -- System can insert messages from webhook

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- List all tables
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
AND table_name IN (
    'users', 'user_settings', 'expense_categories', 'projects',
    'expenses', 'tasks', 'budgets', 'images', 'whatsapp_messages'
)
ORDER BY table_name;

-- Check RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'users', 'user_settings', 'expense_categories', 'projects',
    'expenses', 'tasks', 'budgets', 'images', 'whatsapp_messages'
)
ORDER BY tablename;

-- List all indexes
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
    'users', 'user_settings', 'expense_categories', 'projects',
    'expenses', 'tasks', 'budgets', 'images', 'whatsapp_messages'
)
ORDER BY tablename, indexname;

-- List all triggers
SELECT 
    trigger_name,
    event_object_table as table_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- List all RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Show expense categories
SELECT id, name, description, color, created_at
FROM expense_categories
ORDER BY name;

-- Database summary statistics
SELECT 
    'users' as table_name,
    COUNT(*) as row_count
FROM users
UNION ALL
SELECT 'user_settings', COUNT(*) FROM user_settings
UNION ALL
SELECT 'expense_categories', COUNT(*) FROM expense_categories
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'expenses', COUNT(*) FROM expenses
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'budgets', COUNT(*) FROM budgets
UNION ALL
SELECT 'images', COUNT(*) FROM images
UNION ALL
SELECT 'whatsapp_messages', COUNT(*) FROM whatsapp_messages
ORDER BY table_name;

-- ============================================================================
-- END OF SCHEMA CREATION
-- ============================================================================
-- Schema created successfully!
-- All tables, indexes, functions, triggers, and RLS policies are in place.
-- ============================================================================

