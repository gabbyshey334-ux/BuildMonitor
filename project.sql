-- =====================================================
-- JengaTrack (Uganda) - Database Schema
-- Complete setup for Supabase PostgreSQL
-- Copy and paste this entire file into Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 2. HELPER FUNCTIONS
-- =====================================================

-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. CORE TABLES
-- =====================================================

-- PROFILES (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  default_currency VARCHAR(3) DEFAULT 'UGX',
  preferred_language VARCHAR(10) DEFAULT 'en',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_profiles_whatsapp ON public.profiles(whatsapp_number) 
  WHERE deleted_at IS NULL;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  budget_amount DECIMAL(15, 2),
  
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_projects_user ON public.projects(user_id) 
  WHERE deleted_at IS NULL;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- EXPENSE CATEGORIES
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL,
  color_hex VARCHAR(7),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  UNIQUE(user_id, name)
);

CREATE INDEX idx_categories_user ON public.expense_categories(user_id) 
  WHERE deleted_at IS NULL;

-- EXPENSES
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  
  description TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'UGX',
  
  source VARCHAR(20) DEFAULT 'whatsapp' CHECK (source IN ('whatsapp', 'dashboard', 'api')),
  
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_expenses_user ON public.expenses(user_id, expense_date DESC) 
  WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_project ON public.expenses(project_id) 
  WHERE deleted_at IS NULL;

CREATE TRIGGER expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- TASKS
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  
  due_date DATE,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_tasks_user ON public.tasks(user_id, status, due_date) 
  WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_project ON public.tasks(project_id) 
  WHERE deleted_at IS NULL;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- IMAGES
CREATE TABLE public.images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  
  storage_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size_bytes INTEGER,
  mime_type VARCHAR(100),
  
  caption TEXT,
  source VARCHAR(20) DEFAULT 'whatsapp' CHECK (source IN ('whatsapp', 'dashboard')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_images_user ON public.images(user_id, created_at DESC) 
  WHERE deleted_at IS NULL;
CREATE INDEX idx_images_expense ON public.images(expense_id) 
  WHERE deleted_at IS NULL;

-- WHATSAPP MESSAGES (Audit Log)
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  whatsapp_message_id VARCHAR(255),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  
  message_body TEXT,
  media_url TEXT,
  
  intent VARCHAR(50),
  processed BOOLEAN DEFAULT FALSE,
  ai_used BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_whatsapp_user ON public.whatsapp_messages(user_id, received_at DESC);
CREATE INDEX idx_whatsapp_unprocessed ON public.whatsapp_messages(processed) 
  WHERE processed = FALSE;

-- AI USAGE LOG (Cost Monitoring)
CREATE TABLE public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  intent VARCHAR(50),
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  model VARCHAR(50),
  
  estimated_cost_usd DECIMAL(10, 6),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_user_date ON public.ai_usage_log(user_id, created_at DESC);

-- =====================================================
-- 4. HELPER FUNCTIONS FOR BUSINESS LOGIC
-- =====================================================

-- Get user ID by WhatsApp number
CREATE OR REPLACE FUNCTION get_user_by_whatsapp(phone VARCHAR)
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM public.profiles 
    WHERE whatsapp_number = phone 
    AND deleted_at IS NULL
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get project budget summary
CREATE OR REPLACE FUNCTION get_project_summary(proj_id UUID)
RETURNS TABLE(
  budget DECIMAL,
  total_spent DECIMAL,
  remaining DECIMAL,
  expense_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.budget_amount,
    COALESCE(SUM(e.amount), 0) AS total_spent,
    COALESCE(p.budget_amount - SUM(e.amount), p.budget_amount) AS remaining,
    COUNT(e.id)::INTEGER AS expense_count
  FROM public.projects p
  LEFT JOIN public.expenses e ON e.project_id = p.id AND e.deleted_at IS NULL
  WHERE p.id = proj_id AND p.deleted_at IS NULL
  GROUP BY p.id, p.budget_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create default project and categories on user signup
CREATE OR REPLACE FUNCTION create_default_project()
RETURNS TRIGGER AS $$
DECLARE
  new_project_id UUID;
BEGIN
  -- Create default project
  INSERT INTO public.projects (user_id, name, description)
  VALUES (NEW.id, 'My Construction Project', 'Default project created automatically')
  RETURNING id INTO new_project_id;
  
  -- Create default categories
  INSERT INTO public.expense_categories (user_id, name, color_hex)
  VALUES 
    (NEW.id, 'Materials', '#3B82F6'),
    (NEW.id, 'Labor', '#EF4444'),
    (NEW.id, 'Equipment', '#F59E0B'),
    (NEW.id, 'Transport', '#10B981'),
    (NEW.id, 'Miscellaneous', '#6B7280');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_user_defaults
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_project();

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Service role has full access to profiles" ON public.profiles
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Projects policies
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to projects" ON public.projects
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Expense categories policies
CREATE POLICY "Users can view own categories" ON public.expense_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" ON public.expense_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON public.expense_categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON public.expense_categories
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to categories" ON public.expense_categories
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Expenses policies
CREATE POLICY "Users can view own expenses" ON public.expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses" ON public.expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses" ON public.expenses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses" ON public.expenses
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to expenses" ON public.expenses
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Tasks policies
CREATE POLICY "Users can view own tasks" ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to tasks" ON public.tasks
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Images policies
CREATE POLICY "Users can view own images" ON public.images
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own images" ON public.images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own images" ON public.images
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to images" ON public.images
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- WhatsApp messages policies
CREATE POLICY "Users can view own messages" ON public.whatsapp_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to messages" ON public.whatsapp_messages
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- AI usage log policies
CREATE POLICY "Users can view own AI usage" ON public.ai_usage_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to AI logs" ON public.ai_usage_log
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 6. STORAGE BUCKET SETUP (Run after table creation)
-- =====================================================

-- Note: Run this in Supabase Storage UI or via API
-- Bucket name: construction-monitor-images
-- Public: false
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- Storage policies (apply after bucket creation):
-- CREATE POLICY "Users can upload own images"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'construction-monitor-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can view own images"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'construction-monitor-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can delete own images"
-- ON storage.objects FOR DELETE
-- USING (bucket_id = 'construction-monitor-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

-- Verify tables were created
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;