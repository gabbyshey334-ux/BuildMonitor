-- Add pending_material_update to profiles for WhatsApp materials confirmation flow
-- Stores { project_id, material_name, quantity, unit } when user is asked to confirm
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pending_material_update JSONB;

COMMENT ON COLUMN profiles.pending_material_update IS 'When set, user is awaiting YES/NO to add a detected material to inventory (project_id, material_name, quantity, unit)';
