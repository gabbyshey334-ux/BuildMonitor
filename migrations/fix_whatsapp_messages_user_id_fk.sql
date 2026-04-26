-- Migration: fix_whatsapp_messages_user_id_fk
-- 
-- The whatsapp_messages.user_id FK previously pointed to public.users.id.
-- WhatsApp-only users created via createUserProfile() only exist in profiles,
-- not in auth.users/public.users, causing silent FK violations on insert.
-- This migration re-targets the FK to profiles.id (ON DELETE SET NULL so
-- orphan rows are handled gracefully rather than blocking the delete).

ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_user_id_fkey;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
