-- Seed Default Expense Categories
-- Run this SQL in Supabase SQL Editor to create default categories

INSERT INTO expense_categories (name, description, color, icon, is_default) VALUES
  ('Materials', 'Construction materials and supplies (cement, bricks, steel, wood, etc.)', '#3B82F6', 'hammer', true),
  ('Labor', 'Worker wages, contractor fees, and professional services', '#10B981', 'users', true),
  ('Equipment', 'Tools, machinery rental, and equipment purchases', '#F59E0B', 'wrench', true),
  ('Transport', 'Transportation costs, delivery fees, and fuel', '#8B5CF6', 'truck', true),
  ('Other', 'Miscellaneous expenses not covered by other categories', '#6B7280', 'more-horizontal', true)
ON CONFLICT (name) DO NOTHING;

-- Verify categories were created
SELECT * FROM expense_categories ORDER BY name;


