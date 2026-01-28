# 🚀 Manual Vercel Deployment Guide

## The Issue
Your code is on GitHub, but Vercel isn't connected to your GitHub repository yet. This means Vercel doesn't know about your pushes and won't auto-deploy.

## ✅ Solution: Import GitHub Repo to Vercel

### Step 1: Import Repository (2 minutes)

1. **Open Vercel Import Page**
   ```
   https://vercel.com/new
   ```

2. **Click "Import Git Repository"**
   - Select GitHub
   - Authorize Vercel to access your GitHub if prompted

3. **Find Your Repository**
   - Search for: `gabbyshey334-ux/BuildMonitor`
   - Click "Import"

### Step 2: Configure Project

Vercel should auto-detect most settings from `vercel.json`. Verify:

- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 3: Add Environment Variables (CRITICAL!)

Click "Environment Variables" and add ALL of these:

```bash
# Database (from your .env file)
DATABASE_URL=postgresql://postgres.[your-project-id].[your-region].supabase.co:5432/postgres

# Session Secret (from your .env file)
SESSION_SECRET=[your-64-char-session-secret]

# Twilio (from your .env file)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

**To find your values:**
```bash
cat /Users/cipher/Downloads/BuildMonitor/.env
```

### Step 4: Deploy!

1. Click **"Deploy"** button
2. Wait 2-3 minutes for build
3. You'll get a live URL like: `https://build-monitor-lac.vercel.app`

---

## ✅ After Deployment

### Test Your App
```bash
# Test health endpoint
curl https://build-monitor-lac.vercel.app/health

# Open in browser
open https://build-monitor-lac.vercel.app
```

### Configure Twilio Webhook
Go to Twilio Console and update your WhatsApp webhook:
```
https://build-monitor-lac.vercel.app/webhook/webhook
```

### Future Pushes Auto-Deploy
Once connected, every `git push` to GitHub will automatically trigger a Vercel deployment! ✅

---

## 🔧 Alternative: CLI Deployment

If you have a Vercel token:

```bash
# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

---

## 📊 Verification Checklist

- [ ] GitHub repo imported to Vercel
- [ ] Environment variables configured
- [ ] Deployment successful
- [ ] Health endpoint returns 200
- [ ] Frontend loads without 404
- [ ] Login works (owner/owner123)
- [ ] Twilio webhook updated
- [ ] WhatsApp messages working

---

## 🆘 Troubleshooting

### "Cannot find module" error
- Missing environment variables
- Check DATABASE_URL is set in Vercel

### 404 on all routes
- Should be fixed with new `vercel.json` and `api/index.ts`
- Redeploy if needed

### Build fails
- Check build logs in Vercel dashboard
- Verify all dependencies in `package.json`

---

## 🎯 Quick Reference

| What | URL |
|------|-----|
| Import to Vercel | https://vercel.com/new |
| Your Dashboard | https://vercel.com/dashboard |
| GitHub Repo | https://github.com/gabbyshey334-ux/BuildMonitor |
| Live App (after deploy) | https://build-monitor-lac.vercel.app |

---

**🎉 Once imported, you're done! Future pushes auto-deploy!**

