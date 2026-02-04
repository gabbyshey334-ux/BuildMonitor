# Deploy to Vercel - Instructions

## Current Status
✅ All critical login/signup fixes are committed locally
⚠️ Need to push to GitHub to trigger Vercel auto-deployment

## Option 1: Push to GitHub (Auto-Deploy)

### Step 1: Fix GitHub Authentication

If you get a 403 error, you need to authenticate:

**Using Personal Access Token:**
```bash
# Generate a token at: https://github.com/settings/tokens
# Then use it as password when pushing
git push origin main
```

**Or update remote URL with token:**
```bash
git remote set-url origin https://YOUR_TOKEN@github.com/gabbyshey334-ux/BuildMonitor.git
git push origin main
```

### Step 2: Vercel will auto-deploy
Once pushed, Vercel will automatically detect the changes and deploy.

---

## Option 2: Deploy via Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Select your project: `build-monitor-lac` (or your project name)
3. Click **"Deployments"** tab
4. Click **"Redeploy"** on the latest deployment
5. Or click **"Settings"** → **"Git"** → **"Redeploy"**

---

## Option 3: Deploy via Vercel CLI

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

---

## ⚠️ IMPORTANT: Environment Variables

Before deploying, ensure these are set in Vercel:

1. Go to: **Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**

2. Add/Verify these variables:

   ```
   SESSION_SECRET=77e6061cd23bf8d293902bfe3c8e1cbe7eaf1664425db5fbb3704b761b39049d
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
   SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
   SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
   SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
   NODE_ENV=production
   ```

3. **Select all environments** (Production, Preview, Development)

4. **Redeploy** after adding variables

---

## Verify Deployment

After deployment, test:

1. **Login**: https://build-monitor-lac.vercel.app/login
   - Should work without 500 errors

2. **Signup**: https://build-monitor-lac.vercel.app/signup
   - Should create account successfully

3. **Check API**: https://build-monitor-lac.vercel.app/api/auth/check
   - Should return session status

---

## Troubleshooting

### If deployment fails:
1. Check Vercel build logs for errors
2. Verify all environment variables are set
3. Check that `SESSION_SECRET` is set correctly
4. Ensure `DATABASE_URL` is accessible from Vercel

### If login still fails:
1. Check Vercel function logs
2. Verify `SUPABASE_ANON_KEY` is correct
3. Check that user exists in Supabase Auth

---

## Quick Deploy Command

If you have Vercel CLI installed:
```bash
vercel --prod
```

This will deploy directly without needing to push to GitHub first.

