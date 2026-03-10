-- Add missing columns to existing materials_inventory table
ALTER TABLE public.materials_inventory 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC(12,2) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS last_purchased_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'whatsapp', 'dashboard')),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Rename material_name to name so code is consistent
ALTER TABLE public.materials_inventory 
  RENAME COLUMN material_name TO name;

-- Create material_transactions table for purchase/usage history
CREATE TABLE IF NOT EXISTS public.material_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials_inventory(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'adjustment', 'return')),
  quantity NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  total_cost NUMERIC(12,2) DEFAULT 0,
  description TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'whatsapp', 'dashboard')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS on materials_inventory
ALTER TABLE public.materials_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "materials_own" ON public.materials_inventory;
DROP POLICY IF EXISTS "materials_service" ON public.materials_inventory;

CREATE POLICY "materials_own" ON public.materials_inventory 
  FOR ALL USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "materials_service" ON public.materials_inventory 
  FOR ALL TO service_role USING (true);

-- RLS on material_transactions
ALTER TABLE public.material_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_transactions_own" ON public.material_transactions 
  FOR ALL USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "material_transactions_service" ON public.material_transactions 
  FOR ALL TO service_role USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_material_transactions_material 
  ON public.material_transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_material_transactions_project 
  ON public.material_transactions(project_id);

-- Unique constraint for UPSERT (project_id, name)
ALTER TABLE public.materials_inventory 
  DROP CONSTRAINT IF EXISTS materials_inventory_project_material_unique;
ALTER TABLE public.materials_inventory 
  ADD CONSTRAINT materials_inventory_project_material_unique 
  UNIQUE (project_id, name);

-- Confirm final structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'materials_inventory' 
AND table_schema = 'public'
ORDER BY ordinal_position;
