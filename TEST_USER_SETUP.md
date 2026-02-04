# Test User Setup Guide

This guide will help you create a test user account with sample dashboard data for development and testing.

## Prerequisites

- Access to Supabase dashboard
- Database connection configured (`.env` file with `DATABASE_URL`)
- Node.js and npm installed

---

## Step 1: Create Auth User in Supabase

1. Go to your Supabase project dashboard:
   - URL: `https://supabase.com/dashboard/project/[your-project-id]`
   - Or navigate via: **Supabase Dashboard** → **Your Project**

2. Navigate to: **Authentication** → **Users**

3. Click: **"Add user"** → **"Create new user"**

4. Fill in the form:
   - **Email**: `testuser@buildmonitor.local`
   - **Password**: `TestPassword123!`
   - **Auto Confirm User**: ✅ **YES** (important! This allows immediate login)
   - **Send invitation email**: ❌ No (optional)

5. Click **"Create user"**

6. **Copy the User ID** (UUID that appears in the user list)
   - Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
   - This is the UUID you'll need in the next step

---

## Step 2: Update Seed Script with User ID

1. Open: `server/scripts/seedTestUser.ts`

2. Find line 15:
   ```typescript
   const TEST_USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; // Placeholder UUID
   ```

3. Replace `'a1b2c3d4-e5f6-7890-abcd-ef1234567890'` with your copied User ID from Step 1

4. Save the file

---

## Step 3: Run Seed Script

From the project root directory, run:

```bash
npm run seed:test
```

### Expected Output

```
🌱 Starting test user seed...
─────────────────────────────────────

📝 Creating test user profile...
✅ Profile created: [user-id]
   Email: testuser@buildmonitor.local
   WhatsApp: +256700000001

📝 Creating test project...
✅ Project created: [project-id]
   Name: My Construction Project
   Budget: 10000000 UGX

📝 Creating expense categories...
✅ Categories created: 5
   Categories: Materials, Labor, Equipment, Transport, Miscellaneous

📝 Creating sample expenses...
✅ Expenses created: 7
   Total amount: 1,850,000 UGX

📝 Creating sample tasks...
✅ Tasks created: 5
   Pending: 3, In Progress: 1, Completed: 1

─────────────────────────────────────
🎉 Test user seed completed successfully!
─────────────────────────────────────

📋 Test Credentials:
   Email: testuser@buildmonitor.local
   Password: TestPassword123!
   WhatsApp: +256700000001
   User ID: [user-id]

💡 Note: You must create the auth user in Supabase first!
   Go to: Supabase → Authentication → Users → Add user
   Then update TEST_USER_ID in this script with the User ID.
```

---

## Step 4: Login and Verify

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to the login page

3. Login with:
   - **Email**: `testuser@buildmonitor.local`
   - **Password**: `TestPassword123!`

4. You should see:
   - ✅ Dashboard with budget overview cards
   - ✅ 7 sample expenses in the Recent Expenses table
   - ✅ 5 tasks in the Kanban board (3 pending, 1 in progress, 1 completed)
   - ✅ Expense category breakdown pie chart
   - ✅ Spending over time line chart
   - ✅ Budget progress bar

---

## What Gets Created

### Profile
- User profile with WhatsApp number: `+256700000001`
- Default currency: `UGX`
- Preferred language: `en`

### Project
- **Name**: "My Construction Project"
- **Budget**: 10,000,000 UGX
- **Status**: Active

### Expense Categories (5)
- Materials (Fresh Fern: `#93C54E`)
- Labor (Ocean Pine: `#218598`)
- Equipment (Moss Green: `#B4D68C`)
- Transport (Aqua Breeze: `#6EC1C0`)
- Miscellaneous (Graphite: `#2F3332`)

### Sample Expenses (7)
1. Cement bags - 500,000 UGX (Materials, WhatsApp)
2. Construction workers wages - 300,000 UGX (Labor, Dashboard)
3. Sand delivery - 150,000 UGX (Materials, WhatsApp)
4. Truck rental - 50,000 UGX (Transport, WhatsApp)
5. Bricks - 200,000 UGX (Materials, Dashboard)
6. Generator rental - 250,000 UGX (Equipment, WhatsApp)
7. Masonry work - 400,000 UGX (Labor, Dashboard)

**Total Spent**: 1,850,000 UGX (18.5% of budget)

### Sample Tasks (5)
1. **Inspect foundation** - Pending, High priority (due in 2 days)
2. **Pour foundation** - In Progress, High priority (due in 5 days)
3. **Order additional materials** - Pending, Medium priority (due in 7 days)
4. **Site cleanup** - Completed, Low priority (completed yesterday)
5. **Review building plans** - Pending, Medium priority (due in 3 days)

---

## Troubleshooting

### Error: "User ID not found in Supabase Auth"
- **Solution**: Make sure you created the auth user in Supabase first (Step 1)
- Verify the User ID in the seed script matches the one in Supabase

### Error: "Profile already exists"
- This is normal if you've run the script before
- The script will skip creating duplicate data
- To start fresh, delete the user from Supabase and run the script again

### Error: "Database connection failed"
- Check your `.env` file has `DATABASE_URL` set correctly
- Verify your Supabase connection string is valid
- Ensure your IP is whitelisted in Supabase (if required)

### Error: "Foreign key constraint violation"
- Make sure the User ID in the seed script matches an existing auth user
- The profile `id` must match the Supabase auth user `id`

### Dashboard shows empty data
- Verify the seed script completed successfully
- Check that expenses and tasks were created (check the console output)
- Refresh the browser and clear cache if needed

---

## Resetting Test Data

To reset and recreate all test data:

1. Delete the user from Supabase:
   - Go to: **Authentication** → **Users**
   - Find `testuser@buildmonitor.local`
   - Click **"..."** → **"Delete user"**

2. Delete related database records (optional, they'll cascade):
   - The seed script will handle this automatically on next run

3. Run the seed script again:
   ```bash
   npm run seed:test
   ```

---

## Notes

- The seed script is **idempotent** - you can run it multiple times safely
- It will skip creating data that already exists
- The WhatsApp number `+256700000001` is reserved for testing
- All amounts are in UGX (Ugandan Shillings)
- Dates are spread across the past week for realistic chart data

---

## Next Steps

After setting up the test user:

1. ✅ Test the dashboard UI and charts
2. ✅ Verify expense filtering and search
3. ✅ Test task creation and status updates
4. ✅ Test WhatsApp integration (if configured)
5. ✅ Verify budget calculations
6. ✅ Test mobile responsiveness

Happy testing! 🚀

