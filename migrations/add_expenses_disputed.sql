-- ============================================================================
-- ADD disputed FLAG TO expenses (for group transparency mode)
-- ============================================================================

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS disputed BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN expenses.disputed IS 'Owner flagged in group mode (e.g. "that seems expensive!")';
