-- Indexes for common dashboard and API query patterns

CREATE INDEX IF NOT EXISTS idx_expenses_project_date
  ON expenses (project_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_user_project
  ON expenses (user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_tasks_project_status
  ON tasks (project_id, status);

CREATE INDEX IF NOT EXISTS idx_daily_logs_project_date
  ON daily_logs (project_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_issues_project_status
  ON issues (project_id, status);

CREATE INDEX IF NOT EXISTS idx_projects_manager
  ON projects (manager_id) WHERE manager_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_auth_user
  ON profiles (auth_user_id) WHERE auth_user_id IS NOT NULL;
