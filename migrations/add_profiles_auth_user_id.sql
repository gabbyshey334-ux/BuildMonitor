-- Link WhatsApp-created profiles to web (Supabase Auth) users so that
-- GET /api/projects returns projects created via WhatsApp when the user
-- has linked their WhatsApp number in Settings.
--
-- Run this in Supabase SQL Editor if you use WhatsApp to create projects
-- and want them to appear in the web app after linking your number.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_number ON profiles(whatsapp_number);

COMMENT ON COLUMN profiles.auth_user_id IS 'Set when user links WhatsApp number in web Settings; projects owned by this profile then show for that auth user';
