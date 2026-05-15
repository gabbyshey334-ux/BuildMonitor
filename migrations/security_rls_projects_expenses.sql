-- Strengthen RLS: projects, expenses, tasks — owner OR manager OR linked auth profile
-- Run in Supabase SQL editor after reviewing policies.

-- Projects: read/update for owner, manager, or profile linked via auth_user_id
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own or managed projects" ON projects;
CREATE POLICY "Users read own or managed projects"
ON projects FOR SELECT
USING (
  user_id = auth.uid()
  OR manager_id = auth.uid()
  OR user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users update own or managed projects" ON projects;
CREATE POLICY "Users update own or managed projects"
ON projects FOR UPDATE
USING (
  user_id = auth.uid()
  OR manager_id = auth.uid()
  OR user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users insert own projects" ON projects;
CREATE POLICY "Users insert own projects"
ON projects FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Expenses: scoped via project access
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read project expenses" ON expenses;
CREATE POLICY "Users read project expenses"
ON expenses FOR SELECT
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid()
      OR manager_id = auth.uid()
      OR user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users write project expenses" ON expenses;
CREATE POLICY "Users write project expenses"
ON expenses FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid()
      OR manager_id = auth.uid()
      OR user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users update project expenses" ON expenses;
CREATE POLICY "Users update project expenses"
ON expenses FOR UPDATE
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid()
      OR manager_id = auth.uid()
      OR user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users delete project expenses" ON expenses;
CREATE POLICY "Users delete project expenses"
ON expenses FOR DELETE
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid()
      OR manager_id = auth.uid()
      OR user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  )
);

-- Tasks: project-scoped
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read project tasks" ON tasks;
CREATE POLICY "Users read project tasks"
ON tasks FOR SELECT
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid()
      OR manager_id = auth.uid()
      OR user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users insert project tasks" ON tasks;
CREATE POLICY "Users insert project tasks"
ON tasks FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid()
      OR manager_id = auth.uid()
      OR user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users update project tasks" ON tasks;
CREATE POLICY "Users update project tasks"
ON tasks FOR UPDATE
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid()
      OR manager_id = auth.uid()
      OR user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users delete project tasks" ON tasks;
CREATE POLICY "Users delete project tasks"
ON tasks FOR DELETE
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE user_id = auth.uid()
      OR manager_id = auth.uid()
      OR user_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
  )
);
