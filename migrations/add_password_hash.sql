-- Migration: Add password_hash column to profiles table
-- This enables custom authentication (non-Supabase Auth)

-- Add password_hash column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN password_hash VARCHAR(255);
    
    -- Add index for faster lookups
    CREATE INDEX IF NOT EXISTS idx_profiles_password_hash 
    ON public.profiles(password_hash) 
    WHERE password_hash IS NOT NULL;
    
    RAISE NOTICE 'Added password_hash column to profiles table';
  ELSE
    RAISE NOTICE 'password_hash column already exists';
  END IF;
END $$;

