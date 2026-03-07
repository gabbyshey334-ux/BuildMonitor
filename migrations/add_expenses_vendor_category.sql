-- Run in Supabase SQL Editor if expenses table is missing these columns.
-- Adds optional vendor and category text columns; expense_date should already exist.

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS vendor text,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS expense_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS notes text;
