-- Run in Supabase SQL Editor. Creates tasks table for GET /api/projects/:projectId/tasks (dashboard tasks list).
-- For production parity with the app + WhatsApp bot, run align_supabase_schema_profiles_tasks_vendors_projects.sql next
-- (user_id → profiles, deleted_at, status CHECK, vendors.total_transactions, projects.start_date/status, etc.).

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id);
