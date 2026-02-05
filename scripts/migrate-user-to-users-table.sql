-- Migration script to create user in users table from existing session
-- Run this in Supabase SQL Editor if you have a user ID that exists in session but not in users table

-- Replace this UUID with the actual user ID from your session
-- Example: '0d1d4252-fdb8-4ec5-acc9-8c00e8d9e3c3'
DO $$
DECLARE
    user_id_to_migrate UUID := '0d1d4252-fdb8-4ec5-acc9-8c00e8d9e3c3'; -- CHANGE THIS
    user_email TEXT;
    user_full_name TEXT;
    user_whatsapp TEXT;
BEGIN
    -- Check if user already exists
    IF EXISTS (SELECT 1 FROM users WHERE id = user_id_to_migrate) THEN
        RAISE NOTICE 'User % already exists in users table', user_id_to_migrate;
        RETURN;
    END IF;

    -- Try to get user data from profiles table (old schema)
    SELECT email, full_name, whatsapp_number
    INTO user_email, user_full_name, user_whatsapp
    FROM profiles
    WHERE id = user_id_to_migrate
    LIMIT 1;

    -- If not found in profiles, use defaults
    IF user_email IS NULL THEN
        -- Get from Supabase Auth if possible
        SELECT email, raw_user_meta_data->>'full_name' as full_name, raw_user_meta_data->>'whatsapp_number' as whatsapp
        INTO user_email, user_full_name, user_whatsapp
        FROM auth.users
        WHERE id = user_id_to_migrate
        LIMIT 1;
    END IF;

    -- If still no data, use defaults
    IF user_email IS NULL THEN
        user_email := 'user-' || user_id_to_migrate::text || '@buildmonitor.local';
        user_full_name := 'User';
        user_whatsapp := '+256000000000';
        RAISE NOTICE 'Using default values for user %', user_id_to_migrate;
    END IF;

    -- Insert user into users table
    INSERT INTO users (id, email, full_name, whatsapp_number, created_at, updated_at)
    VALUES (
        user_id_to_migrate,
        user_email,
        user_full_name,
        user_whatsapp,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    -- Create default user settings
    INSERT INTO user_settings (user_id, language, currency, created_at, updated_at)
    VALUES (user_id_to_migrate, 'en', 'UGX', NOW(), NOW())
    ON CONFLICT (user_id) DO NOTHING;

    RAISE NOTICE '✅ User % migrated successfully', user_id_to_migrate;
    RAISE NOTICE '   Email: %', user_email;
    RAISE NOTICE '   Name: %', user_full_name;
    RAISE NOTICE '   WhatsApp: %', user_whatsapp;
END $$;

