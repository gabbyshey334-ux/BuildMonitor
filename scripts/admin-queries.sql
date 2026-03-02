-- JengaTrack Admin SQL Helpers
-- Run these in Supabase SQL Editor (or psql) with appropriate permissions.

-- View all users
SELECT id, email, full_name,
  whatsapp_number, created_at
FROM profiles
ORDER BY created_at DESC;

-- View all projects
SELECT p.id, p.name, p.budget, p.status,
  pr.full_name AS owner,
  pr.whatsapp_number
FROM projects p
JOIN profiles pr ON p.user_id = pr.id
ORDER BY p.created_at DESC;

-- Reset a user's bot state (replace the phone number)
-- UPDATE profiles
-- SET onboarding_state = NULL,
--     onboarding_data = '{}',
--     onboarding_completed_at = NULL,
--     expense_state = NULL,
--     expense_pending_data = '{}'
-- WHERE whatsapp_number = '+XXXXXXXXXXX';

-- View expenses for a project (replace PROJECT_UUID)
-- SELECT description, amount, expense_date,
--   source, disputed
-- FROM expenses
-- WHERE project_id = 'PROJECT_UUID'
-- ORDER BY expense_date DESC;

-- Check materials inventory (replace PROJECT_UUID)
-- SELECT material_name, quantity, unit,
--   last_updated
-- FROM materials_inventory
-- WHERE project_id = 'PROJECT_UUID'
-- ORDER BY material_name;

-- Daily activity summary (replace PROJECT_UUID)
-- SELECT log_date, worker_count,
--   weather_condition, notes
-- FROM daily_logs
-- WHERE project_id = 'PROJECT_UUID'
-- ORDER BY log_date DESC
-- LIMIT 30;

-- Budget summary per project
SELECT p.name,
  p.budget::numeric AS total_budget,
  COALESCE(SUM(e.amount::numeric), 0) AS spent,
  p.budget::numeric - COALESCE(SUM(e.amount::numeric), 0) AS remaining,
  ROUND(
    COALESCE(SUM(e.amount::numeric), 0) /
    NULLIF(p.budget::numeric, 0) * 100
  ) AS percent_used
FROM projects p
LEFT JOIN expenses e ON e.project_id = p.id
GROUP BY p.id, p.name, p.budget
ORDER BY percent_used DESC;
