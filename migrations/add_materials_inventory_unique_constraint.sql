-- Unique constraint on (project_id, name) for materials_inventory
-- Required for UPSERT (ON CONFLICT) in API and WhatsApp webhook.
-- Run in Supabase SQL Editor if not already applied via alter_materials_inventory_and_transactions.sql.

ALTER TABLE public.materials_inventory
  DROP CONSTRAINT IF EXISTS materials_inventory_project_material_unique;

ALTER TABLE public.materials_inventory
  ADD CONSTRAINT materials_inventory_project_material_unique
  UNIQUE (project_id, name);
