-- =============================================================================
-- Diagnose: Why WhatsApp-created projects don't appear on dashboard
-- Run this in Supabase SQL Editor and check the results.
-- =============================================================================

-- 1) All profiles and how many projects each owns
SELECT
  pr.id,
  pr.email,
  pr.whatsapp_number,
  pr.full_name,
  COUNT(p.id) AS project_count
FROM profiles pr
LEFT JOIN projects p ON p.user_id = pr.id
GROUP BY pr.id, pr.email, pr.whatsapp_number, pr.full_name
ORDER BY project_count DESC;

-- 2) Projects whose owner profile has no "real" email (WhatsApp-only profile)
SELECT
  p.id AS project_id,
  p.name AS project_name,
  p.user_id,
  pr.email,
  pr.whatsapp_number,
  pr.full_name
FROM projects p
JOIN profiles pr ON p.user_id = pr.id
WHERE pr.email IS NULL
   OR pr.email LIKE '%@whatsapp.local';

-- 3) If you have auth_user_id column (after running add_profiles_auth_user_id.sql):
-- SELECT id, email, whatsapp_number, auth_user_id FROM profiles ORDER BY created_at DESC LIMIT 10;
