# 🚀 Vercel Deployment Guide

Complete guide to deploy BuildMonitor to Vercel with serverless functions.

---

## 📋 Prerequisites

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **Git Repository** - Push your code to GitHub, GitLab, or Bitbucket
3. **Supabase Project** - Database must be running and accessible
4. **Environment Variables** - Have all values ready (see below)

---

## 🔧 Environment Variables for Vercel Dashboard

Go to **Vercel Dashboard → Your Project → Settings → Environment Variables** and add:

### 🗄️ Database Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://postgres.ouotjfddslyrraxsimug:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres` | **Supabase Connection Pooler URL** (Transaction mode, port 6543) |

**⚠️ IMPORTANT**: Use the **Connection Pooler URL**, NOT the direct connection string!
- Go to: Supabase Dashboard → Project Settings → Database → Connection Pooling
- Select: **Transaction mode**
- Copy the full connection string

---

### 🔐 Supabase Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `SUPABASE_URL` | `https://ouotjfddslyrraxsimug.supabase.co` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase anonymous/public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase service role key (for admin operations) |

---

### 📱 Twilio Configuration (WhatsApp)

| Variable | Value | Description |
|----------|-------|-------------|
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | `your_twilio_auth_token` | Twilio Auth Token |
| `TWILIO_WHATSAPP_NUMBER` | `whatsapp:+14155238886` | Your Twilio WhatsApp number (sandbox or production) |

**Get from**: [Twilio Console](https://console.twilio.com) → Account Info

---

### 🤖 OpenAI Configuration (Optional - for AI features)

| Variable | Value | Description |
|----------|-------|-------------|
| `OPENAI_API_KEY` | `sk-proj-...` | OpenAI API key (for future AI features) |

**Get from**: [OpenAI Platform](https://platform.openai.com/api-keys)

---

### 🔑 Session & Security

| Variable | Value | Description |
|----------|-------|-------------|
| `SESSION_SECRET` | Generate with: `openssl rand -base64 32` | Session encryption secret (32+ characters) |
| `NODE_ENV` | `production` | Environment mode |

**⚠️ CRITICAL**: Never reuse development SESSION_SECRET in production!

---

### 🌐 Application URLs

| Variable | Value | Description |
|----------|-------|-------------|
| `PORT` | `5000` | Port (Vercel handles this, but set for compatibility) |
| `FRONTEND_URL` | `https://your-app.vercel.app` | Your Vercel deployment URL |
| `OWNER_WHATSAPP_NUMBER` | `+256770000000` | Owner's WhatsApp number for MVP login |

---

## 📦 Deployment Steps

### Step 1: Push Code to Git

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Prepare for Vercel deployment"

# Push to GitHub
git remote add origin https://github.com/yourusername/buildmonitor.git
git branch -M main
git push -u origin main
```

---

### Step 2: Import Project to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. **Import Git Repository**
   - Select your GitHub/GitLab/Bitbucket account
   - Choose the BuildMonitor repository
3. **Configure Project**
   - Framework Preset: **Other**
   - Root Directory: `./` (leave default)
   - Build Command: `npm run vercel-build` (auto-detected)
   - Output Directory: `dist/client` (auto-detected)
   - Install Command: `npm install` (auto-detected)

---

### Step 3: Add Environment Variables

In the **Environment Variables** section during import:

1. Click **Add** for each variable
2. Paste the variable name (e.g., `DATABASE_URL`)
3. Paste the value
4. Select environment: **Production, Preview, Development**
5. Repeat for all 12 variables listed above

**Quick Add Option**: Use Vercel CLI
```bash
vercel env add DATABASE_URL production
# Paste value when prompted
```

---

### Step 4: Deploy

1. Click **Deploy**
2. Vercel will:
   - Install dependencies (`npm install`)
   - Run build (`npm run vercel-build`)
   - Deploy to serverless functions
3. Wait 2-3 minutes for deployment

---

### Step 5: Verify Deployment

1. **Test Health Endpoint**
   ```bash
   curl https://your-app.vercel.app/health
   ```
   Should return:
   ```json
   {
     "status": "ok",
     "database": { "connected": true },
     "services": { "twilio": "configured", "supabase": "configured" }
   }
   ```

2. **Test Login**
   ```bash
   curl -X POST https://your-app.vercel.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"owner","password":"owner123"}'
   ```

3. **Open Dashboard**
   - Visit `https://your-app.vercel.app`
   - Login with: `owner` / `owner123`
   - Verify dashboard loads

---

### Step 6: Configure Twilio Webhook

Update your Twilio WhatsApp webhook to point to Vercel:

1. Go to [Twilio Console → Messaging → Settings](https://console.twilio.com/us1/develop/sms/settings/whatsapp-sender)
2. **When a message comes in**: `https://your-app.vercel.app/webhook/webhook`
3. **Method**: `POST`
4. Save

---

## 🏗️ Architecture Overview

### Vercel Serverless Setup

```
┌─────────────────────────────────────────────┐
│           Vercel Edge Network               │
│                                             │
│  ┌─────────────┐      ┌─────────────────┐ │
│  │   Frontend  │      │  API Functions  │ │
│  │  (Static)   │      │  (Serverless)   │ │
│  │             │      │                 │ │
│  │ Vite Build  │      │  api/index.ts   │ │
│  │ dist/client │      │                 │ │
│  └─────────────┘      └─────────────────┘ │
│         │                      │          │
└─────────┼──────────────────────┼──────────┘
          │                      │
          ├──────────────────────┘
          │
          ▼
    ┌──────────────────────────────┐
    │  External Services           │
    ├──────────────────────────────┤
    │ • Supabase PostgreSQL        │
    │   (Connection Pooler)        │
    │ • Twilio WhatsApp API        │
    │ • OpenAI API (optional)      │
    └──────────────────────────────┘
```

### Request Routing

- `/*` → Static files from `dist/client` (SPA)
- `/api/*` → Express routes via `api/index.ts`
- `/webhook/*` → WhatsApp webhook via `api/index.ts`
- `/health` → Health check via `api/index.ts`

---

## 🔍 Vercel Configuration Files

### `vercel.json`
```json
{
  "version": 2,
  "buildCommand": "npm run vercel-build",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    { "source": "/webhook/(.*)", "destination": "/api/index" },
    { "source": "/health", "destination": "/api/index" },
    { "source": "/(.*)", "destination": "/api/index" }
  ],
  "functions": {
    "api/index.ts": {
      "runtime": "nodejs20.x",
      "memory": 1024,
      "maxDuration": 10
    }
  }
}
```

### `package.json` Scripts
- `vercel-build`: Builds Vite frontend (`vite build`)
- Output: `dist/client/` (static files)

### `api/index.ts`
- Wraps Express app as serverless function
- Imports all routes from `server/routes/`
- Serves static files from `dist/client/`
- Handles SPA fallback for React Router

---

## 🐛 Troubleshooting

### Issue: Database Connection Timeout

**Symptom**: Health check shows `"database": { "connected": false }`

**Solution**:
1. Verify `DATABASE_URL` uses **Connection Pooler** (port 6543)
2. Check Supabase project is active
3. Test connection:
   ```bash
   psql "postgresql://postgres.ouotjfddslyrraxsimug:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
   ```

---

### Issue: Session Not Persisting

**Symptom**: Login works but immediately logs out

**Solution**:
1. Verify `SESSION_SECRET` is set in Vercel
2. Check `DATABASE_URL` for session store
3. Ensure cookies are enabled in browser
4. Verify HTTPS is used (required for secure cookies)

---

### Issue: WhatsApp Webhook Not Receiving Messages

**Symptom**: No messages logged in database

**Solution**:
1. Verify webhook URL in Twilio: `https://your-app.vercel.app/webhook/webhook`
2. Check Twilio credentials in Vercel environment variables
3. Test webhook manually:
   ```bash
   curl -X POST https://your-app.vercel.app/webhook/webhook \
     -d "From=whatsapp:+1234567890&Body=test"
   ```
4. Check Vercel function logs for errors

---

### Issue: Build Fails on Vercel

**Symptom**: Deployment fails during build

**Solution**:
1. Check build logs in Vercel dashboard
2. Verify all TypeScript types compile: `npm run check`
3. Test build locally: `npm run vercel-build`
4. Check for missing dependencies in `package.json`

---

### Issue: Function Timeout

**Symptom**: "504 Gateway Timeout" errors

**Solution**:
1. Check function duration in Vercel logs
2. Increase `maxDuration` in `vercel.json` (free tier max: 10s)
3. Optimize slow database queries
4. Use connection pooler for faster DB connections

---

## 📊 Monitoring & Logs

### View Logs
1. Go to Vercel Dashboard → Your Project → **Deployments**
2. Click on latest deployment
3. Click **Functions** tab
4. Select `api/index` function
5. View real-time logs

### Health Monitoring
- Set up monitoring: `https://your-app.vercel.app/health`
- Use services like UptimeRobot, Pingdom, or Vercel Analytics
- Check database connection status

---

## 🔄 Updating After Deployment

### Push Updates
```bash
# Make changes
git add .
git commit -m "Update feature"
git push

# Vercel auto-deploys on push to main branch
```

### Manual Redeploy
```bash
# Using Vercel CLI
vercel --prod

# Or trigger from dashboard
# Vercel Dashboard → Deployments → Redeploy
```

### Update Environment Variables
```bash
# Using Vercel CLI
vercel env add VARIABLE_NAME production

# Or via dashboard
# Vercel Dashboard → Settings → Environment Variables
```

---

## 🎯 Production Checklist

Before going live:

- [ ] All 12 environment variables set in Vercel
- [ ] `DATABASE_URL` uses connection pooler (port 6543)
- [ ] `SESSION_SECRET` is strong and unique (32+ characters)
- [ ] Health endpoint returns `"status": "ok"`
- [ ] Login works and creates sessions
- [ ] Dashboard loads and displays data
- [ ] Twilio webhook configured correctly
- [ ] WhatsApp messages are received and logged
- [ ] Test expense creation via WhatsApp
- [ ] Test expense creation via dashboard
- [ ] Verify RLS policies in Supabase
- [ ] Set up monitoring/alerting
- [ ] Configure custom domain (optional)
- [ ] Enable Vercel Analytics (optional)

---

## 🌟 Vercel Features to Enable

### Vercel Analytics
```bash
npm install @vercel/analytics
```

Add to `client/src/main.tsx`:
```typescript
import { Analytics } from '@vercel/analytics/react';

<Analytics />
```

### Vercel Speed Insights
```bash
npm install @vercel/speed-insights
```

### Custom Domain
1. Vercel Dashboard → Settings → Domains
2. Add your domain
3. Update DNS records as instructed

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Supabase Connection Pooler](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp/quickstart)

---

## 🆘 Support

If you encounter issues:

1. Check Vercel function logs
2. Test endpoints with curl/Postman
3. Verify environment variables
4. Check Supabase dashboard for database errors
5. Review Twilio webhook logs

---

**Last Updated**: January 26, 2026  
**Vercel-Ready**: ✅ Yes

