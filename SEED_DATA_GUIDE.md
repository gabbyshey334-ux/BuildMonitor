# Seed Data Guide - Populate Dashboard with Sample Data

## Current Status

✅ **Supabase Connection**: Working  
✅ **Drizzle ORM**: Connected  
⚠️ **Database Tables**: Empty (no data yet)

## Quick Fix: Seed Test Data

Your database is connected but empty. Here's how to populate it with sample data:

### Option 1: Use the Test User Seed Script (Recommended)

The project includes a seed script that creates a test user with sample data.

**Prerequisites:**
1. Create a Supabase Auth user first:
   - Go to: https://supabase.com/dashboard/project/ouotjfddslyrraxsimug/auth/users
   - Click "Add user" → "Create new user"
   - Email: `testuser@jengatrack.local`
   - Password: `TestPassword123!`
   - ✅ Check "Auto Confirm User"
   - Click "Create user"
   - **Copy the User ID** (UUID)

2. Update the seed script with the User ID:
   - Open: `server/scripts/seedTestUser.ts`
   - Find: `const TEST_USER_ID = '...'`
   - Replace with your copied User ID

3. Run the seed script:
   ```bash
   npm run seed:test
   ```

**What it creates:**
- ✅ User profile
- ✅ Active project with budget
- ✅ 5 expense categories (Materials, Labor, Equipment, Transport, Miscellaneous)
- ✅ 5 sample expenses
- ✅ 4 sample tasks

### Option 2: Create Data via API (After Login)

Once you have a user account:

1. **Login** at `/login`
2. **Create a project** via `/api/projects` POST
3. **Add expenses** via `/api/expenses` POST
4. **Add tasks** via `/api/tasks` POST

### Option 3: Use Supabase SQL Editor

Run this SQL in Supabase SQL Editor to create sample data:

```sql
-- Create a test profile (replace USER_ID with actual Supabase Auth user ID)
INSERT INTO profiles (id, whatsapp_number, full_name, default_currency, preferred_language, created_at, updated_at)
VALUES (
  'YOUR_USER_ID_HERE',
  '+256700000001',
  'Test User',
  'UGX',
  'en',
  NOW(),
  NOW()
);

-- Create a project
INSERT INTO projects (user_id, name, description, budget_amount, status, created_at, updated_at)
VALUES (
  'YOUR_USER_ID_HERE',
  'My Construction Project',
  'Sample project with demo data',
  '10000000',
  'active',
  NOW(),
  NOW()
);

-- Create expense categories
INSERT INTO expense_categories (user_id, name, color_hex, created_at)
VALUES
  ('YOUR_USER_ID_HERE', 'Materials', '#93C54E', NOW()),
  ('YOUR_USER_ID_HERE', 'Labor', '#218598', NOW()),
  ('YOUR_USER_ID_HERE', 'Equipment', '#B4D68C', NOW()),
  ('YOUR_USER_ID_HERE', 'Transport', '#6EC1C0', NOW()),
  ('YOUR_USER_ID_HERE', 'Miscellaneous', '#2F3332', NOW());

-- Create sample expenses (get project_id and category_id from above)
INSERT INTO expenses (user_id, project_id, category_id, description, amount, currency, source, expense_date, created_at, updated_at)
SELECT 
  'YOUR_USER_ID_HERE',
  p.id,
  ec.id,
  'Cement bags (50kg x 10)',
  '500000',
  'UGX',
  'whatsapp',
  NOW(),
  NOW(),
  NOW()
FROM projects p, expense_categories ec
WHERE p.user_id = 'YOUR_USER_ID_HERE' AND ec.name = 'Materials' AND ec.user_id = 'YOUR_USER_ID_HERE'
LIMIT 1;

-- Add more expenses similarly...
```

## Verify Data Was Created

After seeding, test the endpoints:

```bash
# Test Supabase connection (should show counts > 0)
curl https://build-monitor-lac.vercel.app/api/test/supabase

# After login, test dashboard summary
curl https://build-monitor-lac.vercel.app/api/dashboard/summary \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID"
```

## Next Steps

1. ✅ **Drizzle is connected** - Database queries will work
2. ⚠️ **Seed data** - Populate tables with sample data
3. ✅ **Test dashboard** - Login and view dashboard with data
4. ✅ **Test API endpoints** - Verify all endpoints return data

## Troubleshooting

**If seed script fails:**
- Check that User ID matches Supabase Auth user
- Verify DATABASE_URL is correct
- Check Vercel environment variables

**If dashboard still shows empty:**
- Verify user is logged in (check `/api/auth/me`)
- Check that user has an active project
- Verify data exists in Supabase dashboard

**If API endpoints return 401:**
- User needs to login first
- Session cookie must be set
- Check SESSION_SECRET is configured in Vercel

