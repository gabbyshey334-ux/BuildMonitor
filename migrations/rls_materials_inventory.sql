-- ============================================================================
-- RLS: Allow users to read their own project materials (materials_inventory)
-- Use this if the frontend reads materials via Supabase anon key and bot
-- writes with service_role; ensures users only see materials for their projects.
-- ============================================================================

ALTER TABLE materials_inventory ENABLE ROW LEVEL SECURITY;

-- Drop if exists so migration is idempotent
DROP POLICY IF EXISTS "Users can read their own project materials" ON materials_inventory;

CREATE POLICY "Users can read their own project materials"
ON materials_inventory FOR SELECT
USING (
  project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
);

-- Optional: allow users to insert/update/delete their own project materials (dashboard UI)
DROP POLICY IF EXISTS "Users can manage their own project materials" ON materials_inventory;

CREATE POLICY "Users can manage their own project materials"
ON materials_inventory FOR ALL
USING (
  project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
)
WITH CHECK (
  project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
);
