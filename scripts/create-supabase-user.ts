#!/usr/bin/env tsx
/**
 * Create test user in Supabase Auth
 * Usage: tsx scripts/create-supabase-user.ts <email> <password> <fullName> <whatsapp>
 */

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env') });

import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const email = process.argv[2] || 'test@example.com';
const password = process.argv[3] || 'TestPassword123!';
const fullName = process.argv[4] || 'Test User';
const whatsapp = process.argv[5] || '+256700000001';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL must be set');
  process.exit(1);
}

async function createUser() {
  console.log('👤 Creating Supabase Auth user...');
  console.log('─────────────────────────────────────\n');

  try {
    // Create Supabase admin client
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 1. Create user in Supabase Auth
    console.log('1️⃣  Creating user in Supabase Auth...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm
      user_metadata: {
        full_name: fullName,
        whatsapp_number: whatsapp,
      },
    });

    if (authError || !authData.user) {
      console.error('   ❌ Error:', authError?.message);
      if (authError?.message?.includes('already registered')) {
        console.log('   💡 User already exists in Supabase Auth');
        console.log('   💡 You can login with this email/password');
        return;
      }
      process.exit(1);
    }

    console.log('   ✅ User created in Supabase Auth');
    console.log('   User ID:', authData.user.id);
    console.log('');

    // 2. Create profile in database
    console.log('2️⃣  Creating profile in database...');
    const sqlClient = postgres(process.env.DATABASE_URL!);

    try {
      await sqlClient`
        INSERT INTO profiles (id, email, whatsapp_number, full_name, created_at, updated_at)
        VALUES (${authData.user.id}, ${email}, ${whatsapp}, ${fullName}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            whatsapp_number = EXCLUDED.whatsapp_number,
            full_name = EXCLUDED.full_name,
            updated_at = NOW()
      `;
      console.log('   ✅ Profile created/updated');
    } catch (profileError: any) {
      console.error('   ❌ Profile error:', profileError.message);
      // Don't exit - user is created in Auth, profile can be fixed later
    }

    await sqlClient.end();

    console.log('');
    console.log('─────────────────────────────────────');
    console.log('✅ User created successfully!');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   Full Name:', fullName);
    console.log('   WhatsApp:', whatsapp);
    console.log('   User ID:', authData.user.id);
    console.log('─────────────────────────────────────');
    console.log('');
    console.log('💡 You can now login with:');
    console.log('   POST /api/auth/login');
    console.log('   { "email": "' + email + '", "password": "' + password + '" }');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createUser();

