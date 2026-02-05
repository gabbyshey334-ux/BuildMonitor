-- ============================================================================
-- DROP EVERYTHING SCRIPT
-- ============================================================================
-- This script drops all tables, functions, triggers, and RLS policies
-- in the correct order to handle dependencies.
-- 
-- WARNING: This will delete ALL data in the database!
-- Use with caution in production.
-- ============================================================================

-- Disable RLS temporarily for easier cleanup
ALTER TABLE IF EXISTS whatsapp_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS images DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS budgets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expense_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;

-- Drop triggers first (they depend on functions)
DROP TRIGGER IF EXISTS update_project_spent_trigger ON expenses;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
DROP TRIGGER IF EXISTS update_budgets_updated_at ON budgets;

-- Drop RLS policies
DROP POLICY IF EXISTS users_select_own ON users;
DROP POLICY IF EXISTS users_update_own ON users;
DROP POLICY IF EXISTS user_settings_select_own ON user_settings;
DROP POLICY IF EXISTS user_settings_insert_own ON user_settings;
DROP POLICY IF EXISTS user_settings_update_own ON user_settings;
DROP POLICY IF EXISTS expense_categories_select_all ON expense_categories;
DROP POLICY IF EXISTS projects_select_own ON projects;
DROP POLICY IF EXISTS projects_insert_own ON projects;
DROP POLICY IF EXISTS projects_update_own ON projects;
DROP POLICY IF EXISTS projects_delete_own ON projects;
DROP POLICY IF EXISTS expenses_select_own ON expenses;
DROP POLICY IF EXISTS expenses_insert_own ON expenses;
DROP POLICY IF EXISTS expenses_update_own ON expenses;
DROP POLICY IF EXISTS expenses_delete_own ON expenses;
DROP POLICY IF EXISTS tasks_select_own ON tasks;
DROP POLICY IF EXISTS tasks_insert_own ON tasks;
DROP POLICY IF EXISTS tasks_update_own ON tasks;
DROP POLICY IF EXISTS tasks_delete_own ON tasks;
DROP POLICY IF EXISTS budgets_select_own ON budgets;
DROP POLICY IF EXISTS budgets_insert_own ON budgets;
DROP POLICY IF EXISTS budgets_update_own ON budgets;
DROP POLICY IF EXISTS budgets_delete_own ON budgets;
DROP POLICY IF EXISTS images_select_own ON images;
DROP POLICY IF EXISTS images_insert_own ON images;
DROP POLICY IF EXISTS images_delete_own ON images;
DROP POLICY IF EXISTS whatsapp_messages_select_own ON whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_messages_insert_system ON whatsapp_messages;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_project_spent() CASCADE;
DROP FUNCTION IF EXISTS get_user_by_whatsapp(TEXT) CASCADE;

-- Drop tables in reverse order of dependencies (child tables first)
DROP TABLE IF EXISTS whatsapp_messages CASCADE;
DROP TABLE IF EXISTS images CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop extensions if they exist (optional - comment out if you want to keep them)
-- DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
-- DROP EXTENSION IF EXISTS "pgcrypto" CASCADE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check that all tables are dropped
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'users', 'user_settings', 'expense_categories', 'projects',
        'expenses', 'tasks', 'budgets', 'images', 'whatsapp_messages'
    );
    
    IF table_count > 0 THEN
        RAISE NOTICE 'Warning: % tables still exist', table_count;
    ELSE
        RAISE NOTICE '✅ All tables dropped successfully';
    END IF;
END $$;

-- ============================================================================
-- END OF DROP SCRIPT
-- ============================================================================


