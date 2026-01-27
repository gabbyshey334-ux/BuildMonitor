# 🔐 Vercel Environment Variables Quick Reference

Copy these to **Vercel Dashboard → Settings → Environment Variables**

---

## Required Variables (12 Total)

### 1. Database
```
DATABASE_URL=postgresql://postgres.ouotjfddslyrraxsimug:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```
⚠️ Use Connection Pooler (port 6543), NOT direct connection (port 5432)!

---

### 2. Supabase
```
SUPABASE_URL=https://ouotjfddslyrraxsimug.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 3. Twilio WhatsApp
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

---

### 4. OpenAI (Optional)
```
OPENAI_API_KEY=sk-proj-...
```

---

### 5. Session & Security
```
SESSION_SECRET=your_super_secure_random_32_character_secret_here
```
Generate with: `openssl rand -base64 32`

---

### 6. Application
```
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-app.vercel.app
OWNER_WHATSAPP_NUMBER=+256770000000
```

---

## Quick Add via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link project
vercel link

# Add each variable
vercel env add DATABASE_URL production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add TWILIO_ACCOUNT_SID production
vercel env add TWILIO_AUTH_TOKEN production
vercel env add TWILIO_WHATSAPP_NUMBER production
vercel env add OPENAI_API_KEY production
vercel env add SESSION_SECRET production
vercel env add NODE_ENV production
vercel env add PORT production
vercel env add FRONTEND_URL production
vercel env add OWNER_WHATSAPP_NUMBER production
```

---

## Environment Scopes

For each variable, select:
- ✅ **Production** - Live deployment
- ✅ **Preview** - PR deployments (optional)
- ✅ **Development** - Local dev with `vercel dev` (optional)

---

## Where to Get Values

| Variable | Source |
|----------|--------|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection Pooling → Transaction mode |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API → Project API keys → anon/public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → Project API keys → service_role |
| `TWILIO_ACCOUNT_SID` | Twilio Console → Account Info |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Account Info |
| `TWILIO_WHATSAPP_NUMBER` | Twilio Console → Messaging → Senders (format: `whatsapp:+1234567890`) |
| `OPENAI_API_KEY` | OpenAI Platform → API Keys |
| `SESSION_SECRET` | Generate: `openssl rand -base64 32` |
| `FRONTEND_URL` | Your Vercel deployment URL (e.g., `https://buildmonitor.vercel.app`) |
| `OWNER_WHATSAPP_NUMBER` | Your WhatsApp number (format: `+256770000000`) |

---

## ✅ Verification Checklist

After adding all variables:

```bash
# Deploy
vercel --prod

# Test health endpoint
curl https://your-app.vercel.app/health

# Should show:
# "database": { "connected": true }
# "services": { "twilio": "configured", "supabase": "configured" }
```

