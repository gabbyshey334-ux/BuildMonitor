-- Migration: auto_update_project_spent
--
-- Adds a trigger that automatically keeps projects.spent in sync whenever an
-- expense row is inserted, updated (e.g. soft-deleted via deleted_at), or
-- hard-deleted. This replaces the previous manual approach where projects.spent
-- was set once and never refreshed, causing stale values on the dashboard.

CREATE OR REPLACE FUNCTION update_project_spent()
RETURNS TRIGGER AS $$
DECLARE
  target_project_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_project_id := OLD.project_id;
  ELSE
    target_project_id := NEW.project_id;
  END IF;

  IF target_project_id IS NOT NULL THEN
    UPDATE projects
    SET spent = COALESCE((
      SELECT SUM(amount)
      FROM expenses
      WHERE project_id = target_project_id
        AND deleted_at IS NULL
    ), 0),
    updated_at = NOW()
    WHERE id = target_project_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_project_spent ON expenses;
CREATE TRIGGER trigger_update_project_spent
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_project_spent();

-- Backfill existing projects so spent is accurate immediately
UPDATE projects p
SET spent = COALESCE((
  SELECT SUM(amount)
  FROM expenses
  WHERE project_id = p.id
    AND deleted_at IS NULL
), 0),
updated_at = NOW();
