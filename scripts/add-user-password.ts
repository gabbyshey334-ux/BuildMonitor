#!/usr/bin/env tsx
/**
 * Script to add password hash to existing user
 * Usage: tsx scripts/add-user-password.ts <email> <password>
 * Example: tsx scripts/add-user-password.ts test@example.com MyPassword123!
 */

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env') });

import bcrypt from 'bcryptjs';
import postgres from 'postgres';

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('❌ Usage: tsx scripts/add-user-password.ts <email> <password>');
  console.error('   Example: tsx scripts/add-user-password.ts test@example.com MyPassword123!');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in environment variables');
  process.exit(1);
}

async function addPassword() {
  console.log('🔐 Adding password for user:', email);
  console.log('─────────────────────────────────────\n');

  try {
    // Hash password
    console.log('1️⃣  Hashing password...');
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    console.log('   ✅ Password hashed\n');

    // Connect to database
    console.log('2️⃣  Connecting to database...');
    const sql = postgres(process.env.DATABASE_URL!);
    console.log('   ✅ Connected\n');

    // Check if user exists
    console.log('3️⃣  Checking if user exists...');
    const [user] = await sql`
      SELECT id, email, full_name, password_hash
      FROM profiles
      WHERE email = ${email} AND deleted_at IS NULL
      LIMIT 1
    `;

    if (!user) {
      console.error('   ❌ User not found:', email);
      console.error('   💡 Make sure the user exists in the profiles table');
      await sql.end();
      process.exit(1);
    }

    console.log('   ✅ User found:', user.full_name);
    console.log('   User ID:', user.id);
    if (user.password_hash) {
      console.log('   ⚠️  User already has a password hash');
      console.log('   💡 This will overwrite the existing password\n');
    } else {
      console.log('   ℹ️  User does not have a password yet\n');
    }

    // Check if password_hash column exists
    console.log('4️⃣  Checking if password_hash column exists...');
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'password_hash'
    `;

    if (columnCheck.length === 0) {
      console.error('   ❌ password_hash column does not exist');
      console.error('   💡 Run migration first: migrations/add_password_hash.sql');
      await sql.end();
      process.exit(1);
    }
    console.log('   ✅ Column exists\n');

    // Update password hash
    console.log('5️⃣  Updating password hash...');
    await sql`
      UPDATE profiles
      SET password_hash = ${passwordHash}
      WHERE email = ${email}
    `;
    console.log('   ✅ Password hash updated\n');

    // Verify update
    console.log('6️⃣  Verifying update...');
    const [updatedUser] = await sql`
      SELECT email, password_hash IS NOT NULL as has_password
      FROM profiles
      WHERE email = ${email}
      LIMIT 1
    `;
    
    if (updatedUser.has_password) {
      console.log('   ✅ Password successfully added!\n');
      console.log('─────────────────────────────────────');
      console.log('✅ SUCCESS! User can now login with:');
      console.log('   Email:', email);
      console.log('   Password:', password);
      console.log('─────────────────────────────────────\n');
    } else {
      console.error('   ❌ Password hash not found after update');
      await sql.end();
      process.exit(1);
    }

    await sql.end();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

addPassword();

