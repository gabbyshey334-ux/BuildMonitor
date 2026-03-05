-- Run this in Supabase SQL Editor to see why WhatsApp projects might not show on the dashboard.
-- Shows all profiles and how many projects each owns.

SELECT
  pr.id,
  pr.email,
  pr.whatsapp_number,
  pr.full_name,
  pr.auth_user_id,
  COUNT(p.id) AS project_count
FROM profiles pr
LEFT JOIN projects p ON p.user_id = pr.id
GROUP BY pr.id, pr.email, pr.whatsapp_number, pr.full_name, pr.auth_user_id
ORDER BY project_count DESC;

-- If you see two rows for the same person (e.g. one with email, one with whatsapp_number only),
-- that's the mismatch. Fix by either:
-- 1. Register on dashboard with the SAME WhatsApp number, then log in (auto-merge will run), or
-- 2. In Settings > Link WhatsApp, enter your bot number; ensure migrations/add_profiles_auth_user_id.sql has been run.
