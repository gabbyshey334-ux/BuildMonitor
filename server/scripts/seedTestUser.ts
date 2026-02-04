#!/usr/bin/env tsx
/**
 * Seed script to create test user with sample data
 * Run with: npm run seed:test
 */

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env') });

import { db, supabase } from '../db';
import { 
  profiles, 
  projects, 
  expenseCategories, 
  expenses, 
  tasks,
} from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const TEST_EMAIL = 'testuser@buildmonitor.local';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_WHATSAPP = '+256700000001';
const TEST_USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; // Placeholder UUID - UPDATE THIS with actual Supabase User ID

async function seedTestUser() {
  console.log('🌱 Starting test user seed...\n');
  console.log('─────────────────────────────────────\n');

  try {
    // 1. Check if profile already exists
    console.log('1️⃣  Checking for existing test user profile...');
    const existingProfile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.whatsappNumber, TEST_WHATSAPP))
      .limit(1);

    let userId: string;

    if (existingProfile.length > 0) {
      console.log('   ✅ Test user profile already exists');
      console.log(`   User ID: ${existingProfile[0].id}`);
      console.log(`   Name: ${existingProfile[0].fullName}`);
      console.log(`   WhatsApp: ${existingProfile[0].whatsappNumber}\n`);
      userId = existingProfile[0].id;
    } else {
      // Check if auth user exists first
      console.log('   Checking Supabase Auth for existing user...');
      const { data: authUsers, error: authListError } = await supabase.auth.admin.listUsers();
      
      let authUserId: string | null = null;
      if (!authListError && authUsers) {
        const existingAuthUser = authUsers.users.find(u => u.email === TEST_EMAIL);
        if (existingAuthUser) {
          authUserId = existingAuthUser.id;
          console.log(`   ✅ Found existing auth user: ${authUserId}`);
        }
      }

      if (!authUserId) {
        console.log('   ⚠️  No auth user found. Creating auth user in Supabase...');
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: 'Test User',
            whatsapp_number: TEST_WHATSAPP,
          },
        });

        if (authError) {
          console.error(`   ❌ Failed to create auth user: ${authError.message}`);
          console.log('\n💡 Manual Setup Required:');
          console.log('   1. Go to Supabase Dashboard → Authentication → Users');
          console.log('   2. Click "Add user" → "Create new user"');
          console.log(`   3. Email: ${TEST_EMAIL}`);
          console.log(`   4. Password: ${TEST_PASSWORD}`);
          console.log('   5. Auto Confirm User: ✅ YES');
          console.log('   6. Copy the User ID and update TEST_USER_ID in this script\n');
          throw new Error('Auth user creation failed. Please create manually and update TEST_USER_ID.');
        }

        authUserId = authData.user.id;
        console.log(`   ✅ Created auth user: ${authUserId}`);
      }

      // Use provided TEST_USER_ID or the auth user ID
      userId = TEST_USER_ID !== 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' ? TEST_USER_ID : authUserId;

      // Create profile
      console.log('   Creating test user profile...');
      const now = new Date();
      const [profile] = await db.insert(profiles).values({
        id: userId,
        email: TEST_EMAIL,
        whatsappNumber: TEST_WHATSAPP,
        fullName: 'Test User',
        defaultCurrency: 'UGX',
        preferredLanguage: 'en',
        createdAt: now,
        updatedAt: now,
      }).returning();
      
      userId = profile.id;
      console.log('   ✅ Profile created:', userId);
      console.log(`   Name: ${profile.fullName}`);
      console.log(`   Email: ${profile.email}`);
      console.log(`   WhatsApp: ${profile.whatsappNumber}\n`);
    }

    // 2. Check if project exists
    console.log('2️⃣  Checking for existing test project...');
    const existingProject = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .limit(1);

    let projectId: string;

    if (existingProject.length > 0) {
      console.log('   ✅ Test project already exists');
      console.log(`   Project: ${existingProject[0].name} (${existingProject[0].id})\n`);
      projectId = existingProject[0].id;
    } else {
      // Create default project
      console.log('   Creating test project...');
      const now = new Date();
      const [project] = await db.insert(projects).values({
        id: uuidv4(),
        userId: userId,
        name: 'My Construction Project',
        description: 'Sample project with demo data',
        budgetAmount: '10000000', // 10M UGX
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }).returning();
      
      projectId = project.id;
      console.log('   ✅ Project created:', projectId);
      console.log(`   Name: ${project.name}`);
      console.log(`   Budget: UGX ${Number(project.budgetAmount).toLocaleString()}\n`);
    }

    // 3. Check if categories exist
    console.log('3️⃣  Checking for existing expense categories...');
    const existingCategories = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.userId, userId));

    let categoryIds: Record<string, string> = {};

    if (existingCategories.length > 0) {
      console.log(`   ✅ ${existingCategories.length} categories already exist`);
      existingCategories.forEach(cat => {
        categoryIds[cat.name] = cat.id;
        console.log(`      - ${cat.name} (${cat.colorHex})`);
      });
      console.log('');
    } else {
      // Create default categories with brand colors
      console.log('   Creating expense categories...');
      const categories = [
        { name: 'Materials', colorHex: '#93C54E' },      // Fresh Fern
        { name: 'Labor', colorHex: '#218598' },          // Ocean Pine
        { name: 'Equipment', colorHex: '#B4D68C' },       // Moss Green
        { name: 'Transport', colorHex: '#6EC1C0' },      // Aqua Breeze
        { name: 'Miscellaneous', colorHex: '#2F3332' },  // Graphite
      ];

      for (const category of categories) {
        const [cat] = await db.insert(expenseCategories).values({
          id: uuidv4(),
          userId: userId,
          name: category.name,
          colorHex: category.colorHex,
          createdAt: new Date(),
        }).returning();
        
        categoryIds[cat.name] = cat.id;
        console.log(`   ✅ Created category: ${cat.name} (${cat.colorHex})`);
      }
      console.log('');
    }

    // 4. Check if expenses exist
    console.log('4️⃣  Checking for existing sample expenses...');
    const existingExpenses = await db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId));

    if (existingExpenses.length > 0) {
      console.log(`   ✅ ${existingExpenses.length} expenses already exist\n`);
    } else {
      // Create sample expenses
      console.log('   Creating sample expenses...');
      const now = new Date();
      const sampleExpenses = [
        {
          id: uuidv4(),
          userId,
          projectId,
          categoryId: categoryIds['Materials'],
          description: 'Cement bags (50kg x 10)',
          amount: '500000',
          currency: 'UGX',
          source: 'whatsapp',
          expenseDate: new Date().toISOString().split('T')[0],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: uuidv4(),
          userId,
          projectId,
          categoryId: categoryIds['Labor'],
          description: 'Construction workers wages',
          amount: '300000',
          currency: 'UGX',
          source: 'dashboard',
          expenseDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Yesterday
          createdAt: now,
          updatedAt: now,
        },
        {
          id: uuidv4(),
          userId,
          projectId,
          categoryId: categoryIds['Materials'],
          description: 'Sand delivery',
          amount: '150000',
          currency: 'UGX',
          source: 'whatsapp',
          expenseDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days ago
          createdAt: now,
          updatedAt: now,
        },
        {
          id: uuidv4(),
          userId,
          projectId,
          categoryId: categoryIds['Transport'],
          description: 'Truck rental for materials',
          amount: '50000',
          currency: 'UGX',
          source: 'whatsapp',
          expenseDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days ago
          createdAt: now,
          updatedAt: now,
        },
        {
          id: uuidv4(),
          userId,
          projectId,
          categoryId: categoryIds['Materials'],
          description: 'Bricks (1000 pieces)',
          amount: '200000',
          currency: 'UGX',
          source: 'dashboard',
          expenseDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 days ago
          createdAt: now,
          updatedAt: now,
        },
        {
          id: uuidv4(),
          userId,
          projectId,
          categoryId: categoryIds['Equipment'],
          description: 'Concrete mixer rental',
          amount: '120000',
          currency: 'UGX',
          source: 'dashboard',
          expenseDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days ago
          createdAt: now,
          updatedAt: now,
        },
      ];

      await db.insert(expenses).values(sampleExpenses);
      console.log(`   ✅ Created ${sampleExpenses.length} expenses`);
      const totalAmount = sampleExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
      console.log(`   Total: UGX ${totalAmount.toLocaleString()}\n`);
    }

    // 5. Check if tasks exist
    console.log('5️⃣  Checking for existing sample tasks...');
    const existingTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId));

    if (existingTasks.length > 0) {
      console.log(`   ✅ ${existingTasks.length} tasks already exist\n`);
    } else {
      // Create sample tasks
      console.log('   Creating sample tasks...');
      const now = new Date();
      const sampleTasks = [
        {
          id: uuidv4(),
          userId,
          projectId,
          title: 'Inspect foundation',
          description: 'Check concrete curing and ensure proper drainage',
          status: 'pending',
          priority: 'high',
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days from now
          createdAt: now,
          updatedAt: now,
        },
        {
          id: uuidv4(),
          userId,
          projectId,
          title: 'Pour foundation',
          description: 'Schedule concrete delivery for foundation pour',
          status: 'in_progress',
          priority: 'high',
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days from now
          createdAt: now,
          updatedAt: now,
        },
        {
          id: uuidv4(),
          userId,
          projectId,
          title: 'Order additional materials',
          description: 'Get quotes for steel reinforcement bars',
          status: 'pending',
          priority: 'medium',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
          createdAt: now,
          updatedAt: now,
        },
        {
          id: uuidv4(),
          userId,
          projectId,
          title: 'Site cleanup',
          description: 'Remove construction debris',
          status: 'completed',
          priority: 'low',
          completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday
          createdAt: now,
          updatedAt: now,
        },
        {
          id: uuidv4(),
          userId,
          projectId,
          title: 'Review building plans',
          description: 'Verify all measurements and specifications',
          status: 'pending',
          priority: 'medium',
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days from now
          createdAt: now,
          updatedAt: now,
        },
      ];

      await db.insert(tasks).values(sampleTasks);
      console.log(`   ✅ Created ${sampleTasks.length} tasks`);
      const pendingCount = sampleTasks.filter(t => t.status === 'pending').length;
      const inProgressCount = sampleTasks.filter(t => t.status === 'in_progress').length;
      const completedCount = sampleTasks.filter(t => t.status === 'completed').length;
      console.log(`   Status: ${pendingCount} pending, ${inProgressCount} in progress, ${completedCount} completed\n`);
    }

    // Summary
    console.log('─────────────────────────────────────\n');
    console.log('🎉 Test user seed completed successfully!\n');
    console.log('📋 Test Credentials:');
    console.log(`   Email: ${TEST_EMAIL}`);
    console.log(`   Password: ${TEST_PASSWORD}`);
    console.log(`   WhatsApp: ${TEST_WHATSAPP}`);
    console.log(`   User ID: ${userId}\n`);
    console.log('💡 You can now login and see a fully populated dashboard!\n');

  } catch (error: any) {
    console.error('\n❌ Error seeding test user:\n');
    console.error(`   ${error.message}\n`);
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Make sure DATABASE_URL is set in .env');
    console.log('   2. Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    console.log('   3. If auth user creation fails, create manually in Supabase Dashboard');
    console.log('   4. Update TEST_USER_ID in this script with the actual Supabase User ID\n');
    throw error;
  }
}

// Run the seed
seedTestUser()
  .then(() => {
    console.log('✅ Seed script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed script failed:', error);
    process.exit(1);
  });
