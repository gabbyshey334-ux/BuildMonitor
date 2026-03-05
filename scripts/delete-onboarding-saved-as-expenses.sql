-- Run this in Supabase SQL Editor after fixing the WhatsApp onboarding bug.
-- These are project names/locations and budgets that were wrongly saved as expenses
-- when the user confirmed "Yes – Create project!" (e.g. description = project name, amount = budget).

-- Delete project names/locations wrongly saved as expenses (budget as amount).
-- Pavillon Estate: 120000000; others may be in billions (e.g. > 1e9).
DELETE FROM expenses
WHERE description IN (
  'ThankGod Villa',
  'Dosunmu Real Estate',
  'Garuga Mansion',
  'Pavillon Estate'
)
AND (amount > 1000000000 OR amount = 120000000);

-- Optional: see what would be deleted (run as SELECT first to verify)
-- SELECT id, project_id, description, amount, source, created_at
-- FROM expenses
-- WHERE description IN ('ThankGod Villa', 'Dosunmu Real Estate', 'Garuga Mansion')
--   AND amount > 1000000000;
