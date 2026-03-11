-- Add acknowledged_at to issues for PATCH /api/issues/:id when status = 'acknowledged'
ALTER TABLE public.issues
ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;

COMMENT ON COLUMN public.issues.acknowledged_at IS 'Set when status is updated to acknowledged';
