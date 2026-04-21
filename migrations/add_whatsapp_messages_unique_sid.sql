-- migrations/add_whatsapp_messages_unique_sid.sql
--
-- Idempotency guarantee for the Twilio WhatsApp webhook.
--
-- Why:
--   Twilio retries webhooks up to 11 times over ~4h on any non-2xx response
--   or timeout. Without a DB-level uniqueness guarantee on the Twilio
--   MessageSid, a concurrent retry landing on a second serverless instance
--   can bypass the application-level SELECT check and double-write expenses,
--   daily-log notes, etc.
--
-- What this does:
--   Ensures a UNIQUE constraint/index exists on `whatsapp_messages.message_sid`.
--   The production database already has
--   `whatsapp_messages_message_sid_key UNIQUE (message_sid)`, so this is
--   effectively a no-op on existing installations. We still ship the file so
--   fresh environments and branch databases get the same guarantee.
--
-- Column name note:
--   The actual column is `message_sid` (text). The Drizzle schema previously
--   mis-named it `whatsapp_message_id`, which caused every idempotency insert
--   in the webhook to silently fail. The webhook code was corrected alongside
--   this migration — see api/_whatsapp-webhook.ts.
--
-- Safe to run repeatedly (CREATE UNIQUE INDEX IF NOT EXISTS).

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_message_sid_unique
  ON public.whatsapp_messages (message_sid)
  WHERE message_sid IS NOT NULL;
