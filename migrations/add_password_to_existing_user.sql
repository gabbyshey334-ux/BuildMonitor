-- Helper script: Add password hash for existing user
-- Replace 'user@example.com' with the actual user email
-- Replace 'YourPassword123!' with the desired password

-- This uses bcrypt to hash the password
-- You'll need to hash the password first using a tool or script

-- Example: To add password for user with email 'test@example.com'
-- 1. Hash the password using bcrypt (cost factor 10)
-- 2. Update the profiles table:

-- UPDATE public.profiles 
-- SET password_hash = '$2a$10$hashed_password_here'
-- WHERE email = 'test@example.com';

-- Or use this function to hash and update in one go (requires pgcrypto extension):
-- UPDATE public.profiles 
-- SET password_hash = crypt('YourPassword123!', gen_salt('bf', 10))
-- WHERE email = 'user@example.com';

-- Note: You need to enable pgcrypto extension first:
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;


