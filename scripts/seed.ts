#!/usr/bin/env tsx
/**
 * Database Seed Script
 * Creates test data for development and testing
 */

import { config } from 'dotenv';
config(); // Load .env file

import { db, supabase } from '../server/db';
import { profiles, projects, expenseCategories, expenses } from '../shared/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, sql } from 'drizzle-orm';

console.log('🌱 Seeding Database...\n');
console.log('─────────────────────────────────────\n');

async function seed() {
  try {
    // Test database connection
    console.log('1️⃣  Testing database connection...');
    await db.execute(sql`SELECT 1`);
    console.log('   ✅ Database connected\n');

    // Check if test user already exists
    console.log('2️⃣  Checking for existing test user...');
    const [existingUser] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.whatsappNumber, '+256700000001'))
      .limit(1);

    let userId: string;

    if (existingUser) {
      console.log(`   ℹ️  Test user already exists: ${existingUser.fullName} (${existingUser.id})`);
      console.log('   Skipping user creation.\n');
      userId = existingUser.id;
    } else {
      // Create test user in Supabase Auth first
      console.log('   Creating test user in Supabase Auth...');
      const testEmail = 'testuser@buildmonitor.local';
      const testPassword = 'TestPassword123!';
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
        user_metadata: {
          full_name: 'Test User',
          whatsapp_number: '+256700000001',
        },
      });

      if (authError) {
        console.error(`   ❌ Failed to create auth user: ${authError.message}`);
        throw authError;
      }

      userId = authData.user.id;
      console.log(`   ✅ Created auth user: ${userId}`);

      // Now create the profile
      console.log('   Creating profile...');
      const now = new Date();
      const [newUser] = await db.insert(profiles).values({
        id: userId,
        whatsappNumber: '+256700000001',
        fullName: 'Test User',
        defaultCurrency: 'UGX',
        preferredLanguage: 'en',
        createdAt: now,
        updatedAt: now,
      }).returning();

      console.log(`   ✅ Created profile: ${newUser.fullName} (${newUser.id})`);
      console.log(`   📧 Login credentials: ${testEmail} / ${testPassword}\n`);
    }

    // Check if test project already exists
    console.log('3️⃣  Checking for existing test project...');
    const [existingProject] = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .limit(1);

    let projectId: string;

    if (existingProject) {
      console.log(`   ℹ️  Test project already exists: ${existingProject.name} (${existingProject.id})`);
      console.log('   Skipping project creation.\n');
      projectId = existingProject.id;
    } else {
      // Create default project
      console.log('   Creating test project...');
      projectId = uuidv4();
      const now = new Date();
      const [newProject] = await db.insert(projects).values({
        id: projectId,
        userId: userId,
        name: 'Test Construction Project',
        description: 'A test project for development and testing',
        budgetAmount: 10000000, // 10 Million UGX
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }).returning();

      console.log(`   ✅ Created test project: ${newProject.name} (${newProject.id})\n`);
    }

    // Check if categories already exist
    console.log('4️⃣  Checking for existing categories...');
    const existingCategories = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.userId, userId));

    if (existingCategories.length > 0) {
      console.log(`   ℹ️  ${existingCategories.length} categories already exist for this user`);
      console.log('   Skipping category creation.\n');
    } else {
      // Create default categories
      console.log('   Creating default categories...');
      const defaultCategories = [
        { name: 'Materials', colorHex: '#3B82F6' },     // Blue
        { name: 'Labor', colorHex: '#10B981' },         // Green
        { name: 'Equipment', colorHex: '#F59E0B' },     // Yellow
        { name: 'Transport', colorHex: '#8B5CF6' },     // Purple
        { name: 'Miscellaneous', colorHex: '#6B7280' }, // Gray
      ];

      for (const category of defaultCategories) {
        await db.insert(expenseCategories).values({
          id: uuidv4(),
          userId: userId,
          name: category.name,
          colorHex: category.colorHex,
          createdAt: new Date(),
        });
        console.log(`   ✅ Created category: ${category.name}`);
      }
      console.log('');
    }

    // Get category IDs for sample expenses
    const categories = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.userId, userId));

    const categoryMap = Object.fromEntries(
      categories.map(cat => [cat.name, cat.id])
    );

    // Check if sample expenses already exist
    console.log('5️⃣  Checking for existing sample expenses...');
    const existingExpenses = await db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId))
      .limit(1);

    if (existingExpenses.length > 0) {
      console.log('   ℹ️  Sample expenses already exist for this user');
      console.log('   Skipping expense creation.\n');
    } else {
      // Create 5 sample expenses
      console.log('   Creating sample expenses...');
      const sampleExpenses = [
        {
          description: 'Cement bags for foundation',
          amount: 150000,
          category: 'Materials',
          daysAgo: 5,
        },
        {
          description: 'Bricks for walls',
          amount: 250000,
          category: 'Materials',
          daysAgo: 4,
        },
        {
          description: 'Labor payment for workers',
          amount: 500000,
          category: 'Labor',
          daysAgo: 3,
        },
        {
          description: 'Truck rental for materials',
          amount: 80000,
          category: 'Transport',
          daysAgo: 2,
        },
        {
          description: 'Concrete mixer rental',
          amount: 120000,
          category: 'Equipment',
          daysAgo: 1,
        },
      ];

      for (const expense of sampleExpenses) {
        const expenseDate = new Date();
        expenseDate.setDate(expenseDate.getDate() - expense.daysAgo);
        const now = new Date();

        // Format date as YYYY-MM-DD for the date column
        const expenseDateString = expenseDate.toISOString().split('T')[0];

        await db.insert(expenses).values({
          id: uuidv4(),
          userId: userId,
          projectId: projectId,
          categoryId: categoryMap[expense.category] || null,
          description: expense.description,
          amount: expense.amount,
          currency: 'UGX',
          source: 'dashboard',
          expenseDate: expenseDateString,
          createdAt: now,
          updatedAt: now,
        });

        console.log(`   ✅ Created expense: ${expense.description} (UGX ${expense.amount.toLocaleString()})`);
      }
      console.log('');
    }

    // Summary
    console.log('─────────────────────────────────────\n');
    console.log('📊 Database Seed Summary:\n');
    
    const userProfile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId));

    const userCategories = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.userId, userId));

    const userExpenses = await db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId));

    console.log(`✅ User Profile: ${userProfile[0]?.fullName || 'N/A'}`);
    console.log(`   WhatsApp: ${userProfile[0]?.whatsappNumber || 'N/A'}`);
    console.log(`   User ID: ${userId}`);
    console.log('');
    console.log(`✅ Projects: ${userProjects.length}`);
    userProjects.forEach(project => {
      const budget = project.budgetAmount ? Number(project.budgetAmount).toLocaleString() : '0';
      console.log(`   - ${project.name} (Budget: UGX ${budget})`);
    });
    console.log('');
    console.log(`✅ Categories: ${userCategories.length}`);
    userCategories.forEach(category => {
      console.log(`   - ${category.name} (${category.colorHex})`);
    });
    console.log('');
    console.log(`✅ Sample Expenses: ${userExpenses.length}`);
    const totalSpent = userExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    console.log(`   Total: UGX ${totalSpent.toLocaleString()}`);
    console.log('');

    console.log('─────────────────────────────────────\n');
    console.log('✅ Database seeding completed successfully!\n');
    console.log('💡 You can now login with:');
    console.log('   Username: owner');
    console.log('   Password: owner123\n');
    console.log('   Or test WhatsApp with: +256700000001\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Seeding failed:\n');
    console.error(`   ${error.message}\n`);
    console.error('Stack trace:');
    console.error(error.stack);
    console.log('\n💡 Make sure:');
    console.log('   1. Database is running and accessible');
    console.log('   2. Environment variables are set (DATABASE_URL)');
    console.log('   3. Schema is up to date (npm run db:push)\n');
    process.exit(1);
  }
}

// Run seed
seed();

