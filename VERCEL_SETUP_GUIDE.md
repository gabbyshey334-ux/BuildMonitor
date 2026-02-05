# Vercel Deployment Setup Guide

## ✅ Current Status
- ✅ All code is pushed to GitHub: `https://github.com/gabbyshey334-ux/BuildMonitor.git`
- ✅ Latest commit: `6d61eb4` - "chore: Trigger Vercel deployment"
- ✅ `vercel.json` is configured correctly
- ✅ All dashboard components are in the repository

## 🚀 Step-by-Step Vercel Setup

### Option 1: Import from GitHub (Recommended)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Sign in with your GitHub account

2. **Import Project**
   - Click "Add New..." → "Project"
   - Select "Import Git Repository"
   - Find and select: `gabbyshey334-ux/BuildMonitor`
   - Click "Import"

3. **Configure Project Settings**
   - **Framework Preset**: Other
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (should auto-detect from vercel.json)
   - **Output Directory**: `dist/public` (should auto-detect)
   - **Install Command**: `npm install` (default)

4. **Environment Variables** (CRITICAL - Add these in Vercel Dashboard)
   ```
   DATABASE_URL=your_postgresql_connection_string
   SESSION_SECRET=your_random_secret_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   NODE_ENV=production
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at: `https://build-monitor-lac.vercel.app` (or similar)

### Option 2: Deploy via Vercel CLI

If you have Vercel CLI installed:

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Link to existing project or create new
vercel link

# Deploy
vercel --prod
```

## 🔍 Troubleshooting

### If deployment fails:

1. **Check Build Logs**
   - Go to Vercel Dashboard → Your Project → Deployments
   - Click on the failed deployment
   - Check the build logs for errors

2. **Common Issues:**
   - **Missing Environment Variables**: Add all required env vars in Vercel Dashboard
   - **Build Timeout**: Increase build timeout in project settings
   - **Node Version**: Ensure Node.js 18+ is selected in project settings

3. **Verify GitHub Connection**
   - Vercel Dashboard → Project Settings → Git
   - Ensure GitHub repo is connected
   - Check "Production Branch" is set to `main`

## 📋 Pre-Deployment Checklist

- [x] All code pushed to GitHub
- [x] `vercel.json` configured
- [x] `package.json` has `vercel-build` script
- [ ] Environment variables set in Vercel Dashboard
- [ ] GitHub repo connected to Vercel
- [ ] Build command configured correctly

## 🎯 After Deployment

Once deployed, test these endpoints:
- ✅ `https://your-app.vercel.app/` - Landing page
- ✅ `https://your-app.vercel.app/dashboard` - Dashboard (after login)
- ✅ `https://your-app.vercel.app/api/test/supabase` - Database connection test
- ✅ `https://your-app.vercel.app/api/debug/session` - Session debug

## 📞 Need Help?

If deployment still fails:
1. Check Vercel build logs
2. Verify all environment variables are set
3. Ensure GitHub repo is public or Vercel has access
4. Check that `vercel.json` is in the root directory

