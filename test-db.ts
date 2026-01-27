#!/usr/bin/env tsx
/**
 * Database Connection Test Script
 * 
 * Tests the Supabase database connection and verifies table access.
 * Run with: npm run test:db
 */

import { config } from 'dotenv';
config(); // Load .env file

import { db, supabase } from './server/db';
import { sql } from 'drizzle-orm';
import * as schema from './shared/schema';

async function testDatabaseConnection() {
  console.log('🧪 Testing Supabase Database Connection...\n');

  try {
    // Test 1: Basic connection
    console.log('1️⃣  Testing basic database connection...');
    await db.execute(sql`SELECT 1 as test`);
    console.log('✅ Database connection successful!\n');

    // Test 2: Check Supabase client
    console.log('2️⃣  Testing Supabase client...');
    const { data, error } = await supabase.from('profiles').select('count');
    if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist yet
      throw error;
    }
    console.log('✅ Supabase client initialized!\n');

    // Test 3: List all tables
    console.log('3️⃣  Checking database tables...');
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    // Handle different return formats from drizzle
    const tableData = Array.isArray(tables) ? tables : (tables.rows || []);
    const tableNames = tableData.map((row: any) => row.table_name);
    console.log(`Found ${tableNames.length} tables:`);
    tableNames.forEach((name: string) => console.log(`   - ${name}`));
    console.log();

    // Test 4: Check required tables
    console.log('4️⃣  Verifying required tables exist...');
    const requiredTables = [
      'profiles',
      'projects',
      'tasks',
      'expenses',
      'expense_categories',
      'images',
      'whatsapp_messages',
      'ai_usage_log',
    ];
    
    const missingTables = requiredTables.filter(
      table => !tableNames.includes(table)
    );

    if (missingTables.length > 0) {
      console.log(`⚠️  Missing tables: ${missingTables.join(', ')}`);
      console.log('\n💡 Run migrations to create tables:');
      console.log('   npm run db:generate');
      console.log('   npm run db:push\n');
    } else {
      console.log('✅ All required tables exist!\n');
    }

    // Test 5: Check table structures
    console.log('5️⃣  Checking table structures...');
    for (const tableName of requiredTables) {
      if (tableNames.includes(tableName)) {
        const columns = await db.execute(sql`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
          ORDER BY ordinal_position;
        `);
        const columnData = Array.isArray(columns) ? columns : (columns.rows || []);
        console.log(`   ${tableName}: ${columnData.length} columns`);
      }
    }
    console.log();

    // Test 6: Check RLS (Row Level Security)
    console.log('6️⃣  Checking Row Level Security (RLS)...');
    const rlsStatus = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        rowsecurity
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN (${sql.join(requiredTables.map(t => sql`${t}`), sql`, `)})
      ORDER BY tablename;
    `);

    const rlsData = Array.isArray(rlsStatus) ? rlsStatus : (rlsStatus.rows || []);
    const tablesWithoutRLS = rlsData
      .filter((row: any) => !row.rowsecurity)
      .map((row: any) => row.tablename);

    if (tablesWithoutRLS.length > 0) {
      console.log(`⚠️  Tables without RLS: ${tablesWithoutRLS.join(', ')}`);
      console.log('\n💡 Enable RLS in Supabase SQL Editor:');
      tablesWithoutRLS.forEach((table: string) => {
        console.log(`   ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      });
      console.log();
    } else {
      console.log('✅ RLS enabled on all tables!\n');
    }

    // Test 7: Test basic CRUD operations
    console.log('7️⃣  Testing basic operations...');
    
    // Try to count records (should work even with empty tables)
    if (tableNames.includes('expense_categories')) {
      const categoryCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM expense_categories;
      `);
      const countData = Array.isArray(categoryCount) ? categoryCount : (categoryCount.rows || []);
      console.log(`   Expense categories: ${countData[0]?.count || 0}`);
      
      if (countData[0]?.count === 0 || !countData[0]) {
        console.log('   💡 No expense categories found. You may want to seed default categories.');
      }
    }

    if (tableNames.includes('profiles')) {
      const profileCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM profiles;
      `);
      const countData = Array.isArray(profileCount) ? profileCount : (profileCount.rows || []);
      console.log(`   Profiles: ${countData[0]?.count || 0}`);
    }

    if (tableNames.includes('projects')) {
      const projectCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM projects;
      `);
      const countData = Array.isArray(projectCount) ? projectCount : (projectCount.rows || []);
      console.log(`   Projects: ${countData[0]?.count || 0}`);
    }
    console.log();

    // Summary
    console.log('📊 Test Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Database connection: OK');
    console.log('✅ Supabase client: OK');
    console.log(`✅ Tables found: ${tableNames.length}`);
    console.log(`${missingTables.length === 0 ? '✅' : '⚠️ '} Required tables: ${missingTables.length === 0 ? 'All present' : `${missingTables.length} missing`}`);
    console.log(`${tablesWithoutRLS.length === 0 ? '✅' : '⚠️ '} Row Level Security: ${tablesWithoutRLS.length === 0 ? 'Enabled' : `${tablesWithoutRLS.length} without RLS`}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (missingTables.length === 0 && tablesWithoutRLS.length === 0) {
      console.log('🎉 Database is ready to use!\n');
    } else {
      console.log('⚠️  Some setup steps are needed (see messages above)\n');
    }

    process.exit(0);

  } catch (error: any) {
    console.error('❌ Database test failed!\n');
    console.error('Error:', error.message);
    
    if (error.message.includes('DATABASE_URL')) {
      console.error('\n💡 Make sure you have:');
      console.error('   1. Created a .env file');
      console.error('   2. Added your DATABASE_URL from Supabase');
      console.error('   3. Added SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection error. Check that:');
      console.error('   1. Your Supabase project is active');
      console.error('   2. Your DATABASE_URL is correct');
      console.error('   3. Your network allows database connections');
    } else {
      console.error('\n💡 Full error details:');
      console.error(error);
    }
    
    console.error('\n📖 See README.md for setup instructions\n');
    process.exit(1);
  }
}

// Run the test
testDatabaseConnection();
