# 🚀 BuildMonitor Deployment Guide

Complete guide for deploying BuildMonitor to Vercel.

---

## 📋 Prerequisites

- ✅ GitHub repository: https://github.com/gabbyshey334-ux/BuildMonitor
- ✅ Vercel account (sign up at [vercel.com](https://vercel.com))
- ✅ Supabase project with database configured
- ✅ Twilio WhatsApp sandbox or production number
- ✅ All environment variables ready (see below)

---

## 🔐 Environment Variables for Vercel

Go to **Vercel Dashboard → Your Project → Settings → Environment Variables** and add these **12 required variables**:

### 1. Database Configuration

**⚠️ CRITICAL: Use Connection Pooler URL (port 6543), NOT direct connection (port 5432)!**

```env
DATABASE_URL=postgresql://postgres.ouotjfddslyrraxsimug:[YOUR_PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**How to get**: 
- Go to Supabase Dashboard
- Project Settings → Database → Connection Pooling
- Select **Transaction mode**
- Copy the connection string

**Why pooler?**: Vercel serverless functions are short-lived. Direct PostgreSQL connections will timeout. The connection pooler is optimized for serverless environments.

---

### 2. Supabase Configuration

```env
SUPABASE_URL=https://ouotjfddslyrraxsimug.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91b3RqZmRkc2x5cnJheHNpbXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMDAyNzIsImV4cCI6MjA4NDU3NjI3Mn0...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91b3RqZmRkc2x5cnJheHNpbXVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAwMDI3MiwiZXhwIjoyMDg0NTc2MjcyfQ...
```

**How to get**:
- Supabase Dashboard → Project Settings → API
- Copy Project URL
- Copy anon/public key
- Copy service_role key (⚠️ Keep secret!)

---

### 3. Twilio WhatsApp Configuration

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

**How to get**:
- Twilio Console → Account Info
- Copy Account SID
- Copy Auth Token
- Go to Messaging → Senders
- Copy your WhatsApp number (format: `whatsapp:+1234567890`)

**Note**: For sandbox testing, use Twilio's sandbox number. For production, get a WhatsApp Business account number.

---

### 4. OpenAI Configuration (Optional)

```env
OPENAI_API_KEY=sk-proj-...
```

**How to get**:
- OpenAI Platform → API Keys
- Create new key or copy existing

**Note**: Optional for MVP. Required only if implementing AI-powered expense categorization or natural language features.

---

### 5. Session & Security

```env
SESSION_SECRET=your_super_secure_random_32_character_secret_here_abc123
```

**How to generate**:
```bash
openssl rand -base64 32
```

**⚠️ CRITICAL**:
- Must be 32+ characters
- Must be unique per environment
- **NEVER** reuse development secrets in production
- Store securely (never commit to Git)

---

### 6. Environment & Application

```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-project-name.vercel.app
OWNER_WHATSAPP_NUMBER=+256770000000
```

**Notes**:
- `NODE_ENV`: Always set to `production` for Vercel
- `PORT`: Vercel auto-assigns, but set for compatibility (default: 5000)
- `FRONTEND_URL`: Your Vercel deployment URL (update after first deploy)
- `OWNER_WHATSAPP_NUMBER`: Owner's WhatsApp number for MVP login (format: `+256770000000`)

---

## 📊 Environment Variables Summary

| Variable | Required | Where to Get | Purpose |
|----------|----------|--------------|---------|
| `DATABASE_URL` | ✅ Yes | Supabase → Connection Pooler | PostgreSQL connection (⚠️ use pooler!) |
| `SUPABASE_URL` | ✅ Yes | Supabase → API Settings | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ Yes | Supabase → API Settings | Public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | Supabase → API Settings | Admin API key (keep secret!) |
| `TWILIO_ACCOUNT_SID` | ✅ Yes | Twilio → Account Info | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | ✅ Yes | Twilio → Account Info | Twilio authentication token |
| `TWILIO_WHATSAPP_NUMBER` | ✅ Yes | Twilio → Messaging | Your WhatsApp sender number |
| `OPENAI_API_KEY` | ⚠️ Optional | OpenAI Platform | AI features (future) |
| `SESSION_SECRET` | ✅ Yes | Generate yourself | Session encryption (32+ chars) |
| `NODE_ENV` | ✅ Yes | Set manually | Always `production` |
| `PORT` | ⚠️ Optional | Set manually | Port number (Vercel auto-assigns) |
| `FRONTEND_URL` | ⚠️ Optional | Your Vercel URL | Frontend URL for redirects |
| `OWNER_WHATSAPP_NUMBER` | ⚠️ Optional | Your phone | Owner's WhatsApp for MVP login |

**Total**: 9 required, 4 optional = **13 variables**

---

## 🚀 Deployment Steps

### Step 1: Verify GitHub Repository

Your code should already be pushed to:
```
https://github.com/gabbyshey334-ux/BuildMonitor
```

If not yet pushed, run:
```bash
git add .
git commit -m "Production-ready: Complete BuildMonitor MVP"
git push -u origin main
```

---

### Step 2: Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select **GitHub** as your Git provider
4. Authorize Vercel to access your GitHub account
5. Search for or select **"gabbyshey334-ux/BuildMonitor"**
6. Click **"Import"**

---

### Step 3: Configure Project

On the import screen:

**Project Name**: `buildmonitor` (or your preferred name)

**Framework Preset**: **Other** (Vercel will auto-detect)

**Root Directory**: `./` (leave default)

**Build Command**: Leave default or set to:
```bash
npm run vercel-build
```

**Output Directory**: Leave default (Vercel detects `dist/client`)

**Install Command**: Leave default (`npm install`)

---

### Step 4: Add Environment Variables

In the **Environment Variables** section:

**Option A: Add One by One (Recommended)**

1. Click **"Add"** button
2. Enter variable name (e.g., `DATABASE_URL`)
3. Paste the value
4. Select environments: ✅ Production, ✅ Preview, ✅ Development
5. Click **"Add"**
6. Repeat for all 13 variables

**Option B: Use Vercel CLI (Faster)**

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link to your project
vercel link

# Add environment variables
vercel env add DATABASE_URL production
# Paste value when prompted

# Repeat for all variables
```

**⚠️ IMPORTANT**: Add these variables **BEFORE** clicking "Deploy"!

---

### Step 5: Deploy

1. After adding all environment variables, click **"Deploy"**
2. Vercel will:
   - Clone your repository
   - Install dependencies (`npm install`)
   - Build frontend (`npm run vercel-build` → `vite build`)
   - Build backend (automatic via `@vercel/node`)
   - Deploy to production
3. Deployment takes 2-4 minutes
4. You'll see build logs in real-time

---

### Step 6: Verify Deployment

Once deployed, Vercel provides your production URL:
```
https://buildmonitor-[unique-id].vercel.app
```

**Test the deployment**:

1. **Health Check**:
   ```bash
   curl https://your-app.vercel.app/health
   ```
   Should return:
   ```json
   {
     "status": "ok",
     "database": { "connected": true },
     "services": {
       "twilio": "configured",
       "supabase": "configured"
     }
   }
   ```

2. **Login Test**:
   ```bash
   curl -X POST https://your-app.vercel.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"owner","password":"owner123"}'
   ```
   Should return:
   ```json
   {
     "success": true,
     "message": "Login successful",
     "user": { ... }
   }
   ```

3. **Open in Browser**:
   - Visit `https://your-app.vercel.app`
   - Login with: `owner` / `owner123`
   - Verify dashboard loads
   - Check expenses, tasks, categories

---

### Step 7: Configure Twilio Webhook

Update your Twilio WhatsApp webhook to point to Vercel:

1. Go to [Twilio Console → Messaging → WhatsApp Senders](https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders)
2. Select your WhatsApp sender
3. **When a message comes in**:
   ```
   https://your-app.vercel.app/webhook/webhook
   ```
4. **HTTP Method**: `POST`
5. Click **"Save"**

**Test the webhook**:
```bash
# Send test WhatsApp message
# Manually send "log 50000 cement" from your WhatsApp

# Or test via curl:
curl -X POST https://your-app.vercel.app/webhook/webhook \
  -d "From=whatsapp:+256770000000&Body=log 50000 cement"
```

---

### Step 8: Update FRONTEND_URL

After first deployment:

1. Copy your Vercel production URL
2. Go to Vercel Dashboard → Settings → Environment Variables
3. Update `FRONTEND_URL` to your actual URL:
   ```
   https://buildmonitor-[unique-id].vercel.app
   ```
4. Click **"Save"**
5. Vercel will automatically redeploy

---

## 🏗️ Architecture on Vercel

```
┌─────────────────────────────────────────────┐
│         Vercel Edge Network (Global CDN)    │
│                                             │
│  ┌────────────────┐    ┌─────────────────┐ │
│  │   Static SPA   │    │  Node.js Server │ │
│  │  (dist/client) │    │  (server/index) │ │
│  │                │    │                 │ │
│  │  React + Vite  │    │  Express API    │ │
│  │                │    │  + WhatsApp     │ │
│  └────────────────┘    └─────────────────┘ │
│         │                      │            │
└─────────┼──────────────────────┼────────────┘
          │                      │
          └──────────┬───────────┘
                     │
         ┌───────────▼────────────┐
         │   External Services    │
         ├────────────────────────┤
         │ • Supabase PostgreSQL  │
         │   (Connection Pooler)  │
         │ • Twilio WhatsApp API  │
         │ • OpenAI API (future)  │
         └────────────────────────┘
```

**Request Routing**:
- `/` → Static SPA (React)
- `/api/*` → Express API routes
- `/webhook/*` → WhatsApp webhook handler
- `/health` → Health check endpoint

---

## 🔍 Monitoring & Debugging

### View Logs

1. Vercel Dashboard → Your Project → **Deployments**
2. Click on latest deployment
3. Click **"View Function Logs"**
4. See real-time logs from `server/index.ts`

### Common Issues & Solutions

#### Issue: Database Connection Timeout

**Error**: `CONNECT_TIMEOUT` or `Connection refused`

**Solution**:
1. ✅ Verify `DATABASE_URL` uses **Connection Pooler** (port 6543)
2. ✅ Test connection:
   ```bash
   psql "postgresql://postgres.ouotjfddslyrraxsimug:[PASS]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
   ```
3. ✅ Check Supabase project is active
4. ✅ Verify RLS policies don't block connections

---

#### Issue: Build Fails

**Error**: `Command failed: npm run vercel-build`

**Solution**:
1. Test build locally:
   ```bash
   npm run vercel-build
   ```
2. Check TypeScript errors:
   ```bash
   npm run check
   ```
3. Verify all dependencies in `package.json`
4. Check Vercel build logs for specific error

---

#### Issue: Environment Variables Not Loaded

**Error**: `SESSION_SECRET must be set` or similar

**Solution**:
1. Verify all variables are set in Vercel Dashboard
2. Ensure **Production** scope is selected
3. Redeploy after adding variables
4. Check variable names match exactly (case-sensitive)

---

#### Issue: WhatsApp Webhook Not Working

**Error**: Messages sent but not received

**Solution**:
1. ✅ Verify webhook URL in Twilio is correct
2. ✅ Check Twilio credentials in Vercel
3. ✅ Test webhook manually:
   ```bash
   curl -X POST https://your-app.vercel.app/webhook/webhook \
     -d "From=whatsapp:+1234567890&Body=test"
   ```
4. ✅ Check Vercel function logs for errors
5. ✅ Verify Twilio WhatsApp sandbox is active

---

#### Issue: Session Not Persisting

**Error**: Login works but immediately logs out

**Solution**:
1. ✅ Verify `SESSION_SECRET` is set
2. ✅ Check `DATABASE_URL` is correct (session store uses it)
3. ✅ Ensure HTTPS is used (required for secure cookies)
4. ✅ Check browser allows cookies
5. ✅ Verify session table exists in database:
   ```sql
   SELECT * FROM sessions LIMIT 1;
   ```

---

## 🔄 Continuous Deployment

Vercel automatically deploys on every push to `main` branch:

```bash
# Make changes
git add .
git commit -m "Update feature"
git push

# Vercel automatically:
# 1. Detects push
# 2. Builds project
# 3. Runs tests (if configured)
# 4. Deploys to production
```

**Preview Deployments**: Every PR gets its own preview URL for testing before merge.

---

## 📊 Post-Deployment Checklist

- [ ] ✅ Health endpoint returns 200 OK
- [ ] ✅ Database connection successful (`"connected": true`)
- [ ] ✅ All services configured (Twilio, Supabase, OpenAI)
- [ ] ✅ Login works (test with `owner` / `owner123`)
- [ ] ✅ Dashboard loads and displays data
- [ ] ✅ Expenses can be created via dashboard
- [ ] ✅ Tasks can be created via dashboard
- [ ] ✅ Categories are loaded
- [ ] ✅ Twilio webhook configured and tested
- [ ] ✅ WhatsApp messages are received and processed
- [ ] ✅ Expense creation via WhatsApp works
- [ ] ✅ Task creation via WhatsApp works
- [ ] ✅ Session persistence works (stay logged in)
- [ ] ✅ Custom domain configured (optional)
- [ ] ✅ Monitoring/alerting set up (optional)

---

## 🌟 Optional Enhancements

### Custom Domain

1. Vercel Dashboard → Settings → Domains
2. Add your domain (e.g., `buildmonitor.com`)
3. Update DNS records as instructed
4. Vercel automatically provisions SSL certificate

### Analytics

```bash
npm install @vercel/analytics
```

Add to `client/src/main.tsx`:
```typescript
import { Analytics } from '@vercel/analytics/react';

<Analytics />
```

### Speed Insights

```bash
npm install @vercel/speed-insights
```

### Monitoring

Use services like:
- **Vercel Analytics** (built-in)
- **Sentry** (error tracking)
- **LogRocket** (session replay)
- **UptimeRobot** (uptime monitoring)

---

## 🆘 Need Help?

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Twilio Docs**: [twilio.com/docs/whatsapp](https://www.twilio.com/docs/whatsapp)
- **GitHub Issues**: Create issue in repository

---

## 📝 Next Steps After Deployment

1. **Test Thoroughly**: Test all features in production
2. **Monitor Logs**: Watch Vercel function logs for errors
3. **Seed Database**: Run `npm run seed` to populate test data
4. **User Testing**: Invite real users to test WhatsApp integration
5. **Performance**: Monitor response times and optimize slow queries
6. **Security**: Review RLS policies in Supabase
7. **Documentation**: Update README with production URL
8. **Backup**: Set up database backups in Supabase
9. **Alerts**: Configure uptime monitoring
10. **Scale**: Upgrade Vercel plan if needed (free tier limits)

---

**Generated**: January 26, 2026  
**Status**: ✅ Ready for Deployment  
**GitHub**: https://github.com/gabbyshey334-ux/BuildMonitor  
**Vercel**: Ready to import

