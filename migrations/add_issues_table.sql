-- Run this in Supabase SQL Editor to create the issues table for Report Issue and Active Issues count.
-- JengaTrack: POST /api/projects/:projectId/issues and GET summary issues count.

CREATE TABLE IF NOT EXISTS issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  severity text DEFAULT 'medium',
  type text DEFAULT 'general',
  status text DEFAULT 'open' NOT NULL,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS issues_project_id_idx ON issues(project_id);
CREATE INDEX IF NOT EXISTS issues_status_idx ON issues(status);
