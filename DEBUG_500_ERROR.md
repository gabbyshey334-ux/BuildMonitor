# 🔍 Debugging 500 Error on /api/auth/login

## Current Issue
- **Error**: `POST /api/auth/login 500 (Internal Server Error)`
- **Location**: Production (Vercel)

## Most Likely Causes

### 1. Missing Environment Variables in Vercel ⚠️ MOST COMMON

**Required Variables:**
- `SESSION_SECRET` - **CRITICAL** - Session encryption key
- `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key (for auth)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

**Check in Vercel:**
1. Go to: https://vercel.com/dashboard → `build-monitor-lac`
2. Click: **Settings** → **Environment Variables**
3. Verify all variables above are set
4. **Important**: Make sure they're set for **Production** environment

### 2. Database Connection Issue

The login endpoint tests the database connection first. If this fails, you'll see:
```
[AUTH LOGIN] ❌ Database connection failed
```

**Check:**
- `DATABASE_URL` format: `postgresql://user:password@host:port/database`
- Database is accessible from Vercel
- Connection pool limits not exceeded

### 3. Session Store Issue

The app uses PostgreSQL session store. If the sessions table doesn't exist or connection fails:
- Session save will fail
- Login will return 500 error

**Check Vercel Logs for:**
```
[AUTH LOGIN] ❌ Session save error
```

## How to Debug

### Step 1: Check Vercel Logs

1. Go to: https://vercel.com/dashboard → `build-monitor-lac`
2. Click: **Logs** tab
3. Filter by: **Runtime logs**
4. Look for: `[AUTH LOGIN]` messages

**What to look for:**
- `[AUTH LOGIN] ========================================` - Request received
- `[AUTH LOGIN] ✅ Database connection OK` - DB working
- `[AUTH LOGIN] Environment check:` - Shows which env vars are set
- `[AUTH LOGIN] ❌` - Any error messages

### Step 2: Test Debug Endpoint

After deployment, test:
```
GET https://build-monitor-lac.vercel.app/api/debug/db
```

This will show:
- Database connection status
- Which environment variables are set
- Any connection errors

### Step 3: Check Environment Variables

**In Vercel Dashboard:**
1. Settings → Environment Variables
2. Verify these are set for **Production**:
   ```
   SESSION_SECRET=77e6061cd23bf8d293902bfe3c8e1cbe7eaf1664425db5fbb3704b761b39049d
   DATABASE_URL=postgresql://...
   SUPABASE_URL=https://ouotjfddslyrraxsimug.supabase.co
   SUPABASE_ANON_KEY=eyJhbGci...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
   NODE_ENV=production
   ```

**Important:**
- Variables must be set for **Production** environment
- `SESSION_SECRET` is especially critical
- If missing, add them and **redeploy**

### Step 4: Check Session Store

If you see session errors, the PostgreSQL session store might not be initialized:

**Check logs for:**
```
Error: relation "sessions" does not exist
```

**Fix:**
- The app should auto-create the sessions table
- If not, you may need to run migrations manually

## Quick Fixes

### Fix 1: Add Missing Environment Variables

1. Go to Vercel → Settings → Environment Variables
2. Add any missing variables
3. **Redeploy** (important!)

### Fix 2: Regenerate SESSION_SECRET

If `SESSION_SECRET` is missing or incorrect:

```bash
# Generate new secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then add to Vercel environment variables.

### Fix 3: Verify Database Connection

Test `DATABASE_URL` format:
- Should start with `postgresql://`
- Should include credentials
- Should be accessible from Vercel's IP ranges

## Expected Log Flow (Success)

When login works, you should see:
```
[AUTH LOGIN] ========================================
[AUTH LOGIN] Request received
[AUTH LOGIN] Attempting login for: user@example.com
[AUTH LOGIN] Testing database connection...
[AUTH LOGIN] ✅ Database connection OK
[AUTH LOGIN] Environment check: { hasSupabaseUrl: true, hasAnonKey: true, ... }
[AUTH LOGIN] Creating Supabase auth client...
[AUTH LOGIN] Attempting Supabase sign in...
[AUTH LOGIN] ✅ User authenticated: [user-id]
[AUTH LOGIN] Fetching user profile...
[AUTH LOGIN] ✅ Profile found: [name]
[AUTH LOGIN] Setting session data...
[AUTH LOGIN] ✅ Session saved successfully
[AUTH LOGIN] ✅ Login successful
[AUTH LOGIN] ========================================
```

## Next Steps

1. **Check Vercel logs** - This will show exactly where it's failing
2. **Verify environment variables** - Most common issue
3. **Test debug endpoint** - `/api/debug/db` to check connection
4. **Share logs** - If still failing, share the Vercel log output

---

**The comprehensive logging we added will show exactly what's failing!**

