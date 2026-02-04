# Test User Setup Guide

This guide will help you create a test user account with sample dashboard data for development and testing.

## Prerequisites

- Node.js and npm installed
- `.env` file configured with:
  - `DATABASE_URL` (Supabase PostgreSQL connection string)
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Database schema is up to date (run `npm run db:push` if needed)

---

## Step 1: Create Auth User in Supabase

1. Go to your Supabase Dashboard:
   - URL: https://supabase.com/dashboard/project/[your-project-id]
   - Or navigate via: **Authentication** → **Users**

2. Click: **"Add user"** → **"Create new user"**

3. Fill in the form:
   - **Email**: `testuser@buildmonitor.local`
   - **Password**: `TestPassword123!`
   - **Auto Confirm User**: ✅ **YES** (important! This allows immediate login)
   - **Send confirmation email**: ❌ No (optional, since we're auto-confirming)

4. Click **"Create user"**

5. **Copy the User ID** (UUID that appears in the user list)
   - Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
   - You'll need this for Step 2

---

## Step 2: Update Seed Script with User ID

1. Open the seed script:
   ```
   server/scripts/seedTestUser.ts
   ```

2. Find this line (around line 20):
   ```typescript
   const TEST_USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; // Placeholder UUID - UPDATE THIS
   ```

3. Replace the placeholder UUID with the User ID you copied from Step 1:
   ```typescript
   const TEST_USER_ID = 'your-actual-user-id-here'; // From Supabase Auth
   ```

4. Save the file

---

## Step 3: Run Seed Script

Run the seed script to create the test user profile and sample data:

```bash
npm run seed:test
```

### Expected Output

```
🌱 Starting test user seed...

─────────────────────────────────────

1️⃣  Checking for existing test user profile...
   ✅ Test user profile already exists
   User ID: [user-id]
   Name: Test User
   WhatsApp: +256700000001

2️⃣  Checking for existing test project...
   ✅ Test project already exists
   Project: My Construction Project ([project-id])

3️⃣  Checking for existing expense categories...
   ✅ 5 categories already exist
      - Materials (#93C54E)
      - Labor (#218598)
      - Equipment (#B4D68C)
      - Transport (#6EC1C0)
      - Miscellaneous (#2F3332)

4️⃣  Checking for existing sample expenses...
   ✅ 6 expenses already exist

5️⃣  Checking for existing sample tasks...
   ✅ 5 tasks already exist

─────────────────────────────────────

🎉 Test user seed completed successfully!

📋 Test Credentials:
   Email: testuser@buildmonitor.local
   Password: TestPassword123!
   WhatsApp: +256700000001
   User ID: [user-id]

💡 You can now login and see a fully populated dashboard!
```

---

## Step 4: Login and Verify

1. Start the development server (if not already running):
   ```bash
   npm run dev
   ```

2. Navigate to the login page

3. Login with:
   - **Email**: `testuser@buildmonitor.local`
   - **Password**: `TestPassword123!`

4. You should see:
   - ✅ Dashboard with budget overview cards
   - ✅ 6 sample expenses in the Recent Expenses table
   - ✅ 5 tasks in the Kanban board (Pending, In Progress, Completed)
   - ✅ Expense category breakdown pie chart
   - ✅ Spending over time line chart
   - ✅ Budget progress bar

---

## What Gets Created

The seed script creates:

### 1. User Profile
- Email: `testuser@buildmonitor.local`
- WhatsApp: `+256700000001`
- Full Name: `Test User`
- Default Currency: `UGX`
- Preferred Language: `en`

### 2. Project
- Name: `My Construction Project`
- Budget: `UGX 10,000,000`
- Status: `active`

### 3. Expense Categories (5)
- **Materials** - Fresh Fern (#93C54E)
- **Labor** - Ocean Pine (#218598)
- **Equipment** - Moss Green (#B4D68C)
- **Transport** - Aqua Breeze (#6EC1C0)
- **Miscellaneous** - Graphite (#2F3332)

### 4. Sample Expenses (6)
- Cement bags (UGX 500,000) - Today
- Construction workers wages (UGX 300,000) - Yesterday
- Sand delivery (UGX 150,000) - 2 days ago
- Truck rental (UGX 50,000) - 3 days ago
- Bricks (UGX 200,000) - 4 days ago
- Concrete mixer rental (UGX 120,000) - 5 days ago

**Total Spent**: UGX 1,320,000 (13.2% of budget)

### 5. Sample Tasks (5)
- **Pending** (3):
  - Inspect foundation (High priority, due in 2 days)
  - Order additional materials (Medium priority, due in 7 days)
  - Review building plans (Medium priority, due in 3 days)
- **In Progress** (1):
  - Pour foundation (High priority, due in 5 days)
- **Completed** (1):
  - Site cleanup (Low priority, completed yesterday)

---

## Troubleshooting

### Error: "Auth user creation failed"

**Solution**: The script will try to create the auth user automatically, but if it fails:
1. Create the auth user manually in Supabase Dashboard (Step 1)
2. Copy the User ID
3. Update `TEST_USER_ID` in the seed script (Step 2)
4. Run the seed script again

### Error: "DATABASE_URL must be set"

**Solution**: Make sure your `.env` file has:
```env
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
```

### Error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"

**Solution**: Add to your `.env` file:
```env
SUPABASE_URL=https://[your-project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
```

### Data Already Exists

The script is **idempotent** - it checks for existing data and won't create duplicates. If you want to reset:
1. Delete the test user from Supabase Dashboard
2. Delete related data from the database (or use a fresh database)
3. Run the seed script again

---

## Resetting Test Data

To reset all test data:

1. **Delete from Supabase Dashboard**:
   - Go to Authentication → Users
   - Find `testuser@buildmonitor.local`
   - Delete the user

2. **Delete from Database** (optional, if you want to keep auth user):
   ```sql
   -- Run in Supabase SQL Editor
   DELETE FROM expenses WHERE user_id = '[user-id]';
   DELETE FROM tasks WHERE user_id = '[user-id]';
   DELETE FROM expense_categories WHERE user_id = '[user-id]';
   DELETE FROM projects WHERE user_id = '[user-id]';
   DELETE FROM profiles WHERE id = '[user-id]';
   ```

3. **Run seed script again**:
   ```bash
   npm run seed:test
   ```

---

## Notes

- The seed script is safe to run multiple times - it checks for existing data
- All amounts are in UGX (Ugandan Shillings)
- Dates are spread across the past week for realistic dashboard visualization
- Tasks have different priorities and statuses for a complete Kanban view
- Category colors match the JengaTrack brand palette

---

## Support

If you encounter issues:
1. Check the error message in the console
2. Verify all environment variables are set correctly
3. Ensure database schema is up to date (`npm run db:push`)
4. Check Supabase Dashboard for auth user status
