-- Run this in Supabase SQL Editor after fixing the WhatsApp onboarding bug.
-- These are project names/locations and budgets that were wrongly saved as expenses
-- when the user confirmed "Yes – Create project!" (e.g. description = project name, amount = budget).

DELETE FROM expenses
WHERE description IN (
  'ThankGod Villa',
  'Dosunmu Real Estate',
  'Garuga Mansion'
)
AND amount > 1000000000;

-- Optional: see what would be deleted (run as SELECT first to verify)
-- SELECT id, project_id, description, amount, source, created_at
-- FROM expenses
-- WHERE description IN ('ThankGod Villa', 'Dosunmu Real Estate', 'Garuga Mansion')
--   AND amount > 1000000000;
