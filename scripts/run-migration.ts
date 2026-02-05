#!/usr/bin/env tsx
/**
 * Run database migration to add password_hash column
 * Usage: tsx scripts/run-migration.ts
 */

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env') });

import postgres from 'postgres';
import fs from 'fs';

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in environment variables');
  process.exit(1);
}

async function runMigration() {
  console.log('🔄 Running migration: Add password_hash column');
  console.log('─────────────────────────────────────\n');

  try {
    const sql = postgres(process.env.DATABASE_URL!);
    console.log('✅ Connected to database\n');

    // Read migration file
    const migrationPath = join(process.cwd(), 'migrations', 'add_password_hash.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log('📄 Running migration SQL...\n');

    // Execute migration
    await sql.unsafe(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    // Verify column exists
    console.log('🔍 Verifying column exists...');
    const result = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'password_hash'
    `;

    if (result.length > 0) {
      console.log('✅ password_hash column exists in profiles table\n');
    } else {
      console.error('❌ Column not found after migration');
      await sql.end();
      process.exit(1);
    }

    await sql.end();
    console.log('─────────────────────────────────────');
    console.log('✅ Migration successful!');
    console.log('💡 Next: Add password for your user:');
    console.log('   tsx scripts/add-user-password.ts <email> <password>');
    console.log('─────────────────────────────────────\n');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

runMigration();

