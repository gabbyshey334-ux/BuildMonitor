-- Run in Supabase SQL Editor. Fix expenses source check to allow 'dashboard' and 'manual'.

-- See what the current constraint allows:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'expenses_source_check';

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_source_check;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_source_check
  CHECK (source IN (
    'whatsapp', 'dashboard', 'manual', 'ocr',
    'voice', 'api', 'import'
  ));
