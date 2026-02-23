-- ============================================================================
-- NEW TABLES: materials_inventory, vendors, daily_logs
-- ============================================================================
-- Run after add_channel_type_and_expense_state.sql

CREATE TABLE IF NOT EXISTS materials_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_materials_project ON materials_inventory(project_id);
CREATE INDEX idx_materials_name ON materials_inventory(project_id, material_name);

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  total_spent NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendors_project ON vendors(project_id);

CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  worker_count INTEGER,
  notes TEXT,
  weather_condition TEXT,
  photo_urls JSONB,  -- array of URL strings
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, log_date)
);

CREATE INDEX idx_daily_logs_project ON daily_logs(project_id);
CREATE INDEX idx_daily_logs_date ON daily_logs(log_date);
