# Dashboard Connection to Supabase - Troubleshooting Guide

## Problem
The dashboard isn't showing data even though there's data in Supabase.

## Root Causes
1. **Authentication**: User not logged in (session not set)
2. **Database Connection**: Drizzle ORM can't connect to PostgreSQL
3. **Supabase Connection**: Supabase client can't connect
4. **Missing Project**: User has no active project
5. **RLS Policies**: Row Level Security blocking access

---

## Step 1: Test Supabase Connection

**Test Endpoint:** `https://your-app.vercel.app/api/test/supabase`

This endpoint tests:
- ✅ Supabase client connection
- ✅ Database tables (profiles, projects, expenses, tasks)
- ✅ Drizzle ORM connection
- ✅ Environment variables

**Expected Response:**
```json
{
  "status": "ok",
  "connection": "successful",
  "data": {
    "profiles": { "count": 1, "error": null, "sample": [...] },
    "projects": { "count": 1, "error": null, "sample": [...] },
    "expenses": { "count": 5, "error": null, "sample": [...] },
    "tasks": { "count": 3, "error": null, "sample": [...] }
  },
  "drizzle": { "connected": true, "error": null }
}
```

**If you see errors:**
- Check Vercel environment variables
- Verify DATABASE_URL is correct
- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set

---

## Step 2: Check Authentication

**Test Endpoint:** `https://your-app.vercel.app/api/auth/me`

**Expected Response (if logged in):**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "whatsappNumber": "+256...",
    "fullName": "User Name"
  }
}
```

**Expected Response (if NOT logged in):**
```json
{
  "success": false,
  "error": "Authentication required"
}
```

**If not authenticated:**
1. Login at `/login`
2. Check browser cookies for `jengatrack.sid`
3. Verify session is being set on login

---

## Step 3: Check Dashboard Endpoints

All dashboard endpoints require authentication. Test them after logging in:

### Dashboard Summary
**GET** `/api/dashboard/summary`

**Expected Response:**
```json
{
  "success": true,
  "summary": {
    "budget": 10000000,
    "totalSpent": 4800000,
    "remaining": 5200000,
    "percentUsed": 48,
    "expenseCount": 8,
    "taskCount": 6,
    "projectName": "My Construction Project",
    "projectId": "project-uuid"
  }
}
```

**If you see "No active project found":**
- User needs to create a project first
- Or set an existing project to "active" status

### Expenses
**GET** `/api/expenses?limit=20&offset=0`

**Expected Response:**
```json
{
  "success": true,
  "expenses": [
    {
      "id": "expense-uuid",
      "description": "Cement bags",
      "amount": "500000",
      "categoryName": "Materials",
      "expenseDate": "2024-01-15T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 8,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

### Tasks
**GET** `/api/tasks?status=pending,in_progress,completed&limit=50`

**Expected Response:**
```json
{
  "success": true,
  "tasks": [
    {
      "id": "task-uuid",
      "title": "Inspect foundation",
      "status": "pending",
      "priority": "high",
      "dueDate": "2024-02-10T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 6,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## Step 4: Frontend Data Fetching

The dashboard component (`OverviewDashboard.tsx`) uses React Query to fetch data:

```typescript
// Dashboard summary
queryKey: ['/api/dashboard/summary']

// Expenses
queryKey: ['/api/expenses', { limit: 20, offset: 0 }]

// Tasks
queryKey: ['/api/tasks', { status: 'pending,in_progress,completed', limit: 50 }]
```

**Check Browser Console:**
1. Open DevTools → Network tab
2. Look for requests to `/api/dashboard/summary`, `/api/expenses`, `/api/tasks`
3. Check response status codes:
   - `200` = Success
   - `401` = Not authenticated (need to login)
   - `500` = Server error (check Vercel logs)

---

## Step 5: Common Issues & Fixes

### Issue 1: "Authentication required" (401)
**Cause:** User not logged in or session expired

**Fix:**
1. Login at `/login`
2. Check if session cookie is set
3. Verify `SESSION_SECRET` is set in Vercel

### Issue 2: "No active project found"
**Cause:** User has no project or project is not active

**Fix:**
1. Create a project via `/api/projects` POST
2. Or update existing project status to "active"

### Issue 3: Empty data arrays
**Cause:** No data in database for this user

**Fix:**
1. Check Supabase dashboard for data
2. Verify data belongs to correct user_id
3. Run seed script: `npm run seed:test`

### Issue 4: Database connection errors
**Cause:** DATABASE_URL incorrect or database unreachable

**Fix:**
1. Verify DATABASE_URL in Vercel environment variables
2. Test connection: `/api/test/supabase`
3. Check Vercel function logs for errors

### Issue 5: RLS (Row Level Security) blocking access
**Cause:** Supabase RLS policies preventing data access

**Fix:**
1. Check Supabase → Authentication → Policies
2. Verify policies allow service role to read data
3. Or temporarily disable RLS for testing:
   ```sql
   ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
   ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
   ```

---

## Step 6: Verify Environment Variables in Vercel

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

**Required Variables:**
- ✅ `DATABASE_URL` - Full PostgreSQL connection string
- ✅ `SUPABASE_URL` - Your Supabase project URL
- ✅ `SUPABASE_ANON_KEY` - Supabase anonymous/public key
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for backend)
- ✅ `SESSION_SECRET` - Random secret for session encryption

**After adding/updating variables:**
1. Redeploy the application
2. Test endpoints again

---

## Step 7: Debug Checklist

- [ ] `/api/test/supabase` returns data from all tables
- [ ] `/api/auth/me` returns user data (after login)
- [ ] `/api/dashboard/summary` returns budget/spent data
- [ ] `/api/expenses` returns expense list
- [ ] `/api/tasks` returns task list
- [ ] Browser Network tab shows successful API calls
- [ ] No 401/403/500 errors in console
- [ ] Session cookie `jengatrack.sid` is set
- [ ] Environment variables are set in Vercel
- [ ] User has at least one active project

---

## Quick Test Commands

```bash
# Test Supabase connection
curl https://your-app.vercel.app/api/test/supabase

# Test authentication (after login, use session cookie)
curl https://your-app.vercel.app/api/auth/me \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID"

# Test dashboard summary (after login)
curl https://your-app.vercel.app/api/dashboard/summary \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID"
```

---

## Success Criteria

✅ `/api/test/supabase` shows data from all tables
✅ Login sets session cookie
✅ `/api/auth/me` returns user data
✅ `/api/dashboard/summary` returns budget/spent numbers
✅ `/api/expenses` returns expense list
✅ `/api/tasks` returns task list
✅ Dashboard displays real data
✅ No console errors

---

## Next Steps

1. **Test the connection endpoint** first: `/api/test/supabase`
2. **Check authentication**: Login and verify session
3. **Test dashboard endpoints**: Verify they return data
4. **Check browser console**: Look for fetch errors
5. **Check Vercel logs**: Look for server errors

If all endpoints work but dashboard still doesn't show data, the issue is in the frontend React Query setup.

