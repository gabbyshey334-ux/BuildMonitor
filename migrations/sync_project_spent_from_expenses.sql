-- Keep projects.spent aligned with live expenses (excluding soft-deleted rows).
CREATE OR REPLACE FUNCTION update_project_spent()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects
  SET spent = (
    SELECT COALESCE(SUM(amount), 0)
    FROM expenses
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
      AND deleted_at IS NULL
  )
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_project_spent ON expenses;
CREATE TRIGGER sync_project_spent
AFTER INSERT OR UPDATE OR DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION update_project_spent();
