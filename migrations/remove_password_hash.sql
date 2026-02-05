-- Migration: Remove password_hash column (no longer needed with Supabase Auth)
-- This migration is optional - the column can remain but won't be used

-- Drop password_hash column if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN password_hash;
    RAISE NOTICE 'Removed password_hash column from profiles table';
  ELSE
    RAISE NOTICE 'password_hash column does not exist - nothing to remove';
  END IF;
END $$;

-- Drop index if it exists
DROP INDEX IF EXISTS idx_profiles_password_hash;

