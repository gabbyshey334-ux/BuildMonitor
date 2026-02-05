-- Quick fix for user ID: 0d1d4252-fdb8-4ec5-acc9-8c00e8d9e3c3
-- Run this in Supabase SQL Editor

-- Insert user into users table
INSERT INTO users (id, email, full_name, whatsapp_number, created_at, updated_at)
VALUES (
    '0d1d4252-fdb8-4ec5-acc9-8c00e8d9e3c3',
    'testuser@buildmonitor.local', -- CHANGE THIS to the actual email
    'Test User', -- CHANGE THIS to the actual name
    '+256000000000', -- CHANGE THIS to the actual WhatsApp number
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Create default user settings
INSERT INTO user_settings (user_id, language, currency, created_at, updated_at)
VALUES (
    '0d1d4252-fdb8-4ec5-acc9-8c00e8d9e3c3',
    'en',
    'UGX',
    NOW(),
    NOW()
)
ON CONFLICT (user_id) DO NOTHING;

-- Verify the user was created
SELECT id, email, full_name, whatsapp_number, created_at
FROM users
WHERE id = '0d1d4252-fdb8-4ec5-acc9-8c00e8d9e3c3';

