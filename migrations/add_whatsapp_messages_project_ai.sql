-- ============================================================================
-- ADD project_id and ai_extracted_data TO whatsapp_messages
-- ============================================================================

ALTER TABLE whatsapp_messages 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_extracted_data JSONB;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_project_id ON whatsapp_messages(project_id);
