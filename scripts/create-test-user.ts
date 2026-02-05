#!/usr/bin/env tsx
/**
 * Create test user with password
 * Usage: tsx scripts/create-test-user.ts <email> <password> <whatsapp>
 */

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env') });

import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';

const email = process.argv[2] || 'test@example.com';
const password = process.argv[3] || 'TestPassword123!';
const whatsapp = process.argv[4] || '+256700000001';

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

async function createUser() {
  console.log('👤 Creating test user...');
  console.log('─────────────────────────────────────\n');

  try {
    const sql = postgres(process.env.DATABASE_URL!);
    
    // Check if user exists
    const [existing] = await sql`
      SELECT id, email FROM profiles WHERE email = ${email} AND deleted_at IS NULL LIMIT 1
    `;

    if (existing) {
      console.log('✅ User already exists:', existing.email);
      console.log('   Updating password...\n');
      
      const passwordHash = await bcrypt.hash(password, 10);
      await sql`
        UPDATE profiles 
        SET password_hash = ${passwordHash}
        WHERE email = ${email}
      `;
      
      console.log('✅ Password updated!\n');
      await sql.end();
      return;
    }

    // Create new user
    console.log('1️⃣  Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);
    console.log('   ✅ Password hashed\n');

    console.log('2️⃣  Creating user profile...');
    const userId = uuidv4();
    
    await sql`
      INSERT INTO profiles (id, email, whatsapp_number, full_name, password_hash, created_at, updated_at)
      VALUES (${userId}, ${email}, ${whatsapp}, ${'Test User'}, ${passwordHash}, NOW(), NOW())
    `;
    
    console.log('   ✅ User created\n');
    console.log('─────────────────────────────────────');
    console.log('✅ Test user created!');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   WhatsApp:', whatsapp);
    console.log('   User ID:', userId);
    console.log('─────────────────────────────────────\n');

    await sql.end();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createUser();

