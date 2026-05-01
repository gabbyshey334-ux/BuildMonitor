-- Track when expense_state was last set for automatic expiry of abandoned confirmations
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expense_state_set_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.expense_state_set_at IS 'When expense_state was set; used to expire stale awaiting_confirmation after 30 minutes';
