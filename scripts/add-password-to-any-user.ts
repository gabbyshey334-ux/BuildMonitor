#!/usr/bin/env tsx
/**
 * Add password to any existing user
 */

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env') });

import bcrypt from 'bcryptjs';
import postgres from 'postgres';

async function addPassword() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    // Get first user
    const users = await sql`
      SELECT id, email, whatsapp_number, full_name 
      FROM profiles 
      WHERE deleted_at IS NULL 
      LIMIT 1
    `;

    if (users.length === 0) {
      console.error('❌ No users found in database');
      await sql.end();
      process.exit(1);
    }

    const user = users[0];
    console.log('👤 Found user:', user.email);
    console.log('   Name:', user.full_name);
    console.log('   WhatsApp:', user.whatsapp_number);
    console.log('');

    // Hash password
    const password = 'TestPassword123!';
    console.log('🔐 Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);
    console.log('   ✅ Password hashed');
    console.log('');

    // Update user
    console.log('💾 Updating password_hash...');
    await sql`
      UPDATE profiles 
      SET password_hash = ${passwordHash}
      WHERE id = ${user.id}
    `;
    console.log('   ✅ Password updated');
    console.log('');

    console.log('─────────────────────────────────────');
    console.log('✅ Password added successfully!');
    console.log('   Email:', user.email);
    console.log('   Password:', password);
    console.log('─────────────────────────────────────');

    await sql.end();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await sql.end();
    process.exit(1);
  }
}

addPassword();

