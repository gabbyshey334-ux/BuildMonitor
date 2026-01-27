# Environment Variables Setup Guide

## 📝 Quick Setup

Create your `.env` file by running:

```bash
cp .env.example .env
```

Then fill in the values below.

---

## 🔑 Required Environment Variables

### 1. Node Environment
```env
NODE_ENV=development
PORT=5000
```

**What it does:** Controls app mode and server port  
**Note:** Change to `production` when deploying

---

### 2. Supabase Configuration

#### SUPABASE_URL
```env
SUPABASE_URL=https://xxxxx.supabase.co
```

**Where to find:**
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **Project URL**

---

#### SUPABASE_ANON_KEY
```env
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to find:**
1. Same place as above (**Settings** → **API**)
2. Copy the **anon public** key
3. This is safe to use in frontend code

---

#### SUPABASE_SERVICE_ROLE_KEY
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to find:**
1. Same place (**Settings** → **API**)
2. Copy the **service_role** secret key
3. ⚠️ **NEVER expose this in frontend** - server use only!

---

### 3. Database Connection

#### DATABASE_URL
```env
DATABASE_URL=postgresql://postgres:your-password@db.xxxxx.supabase.co:5432/postgres
```

**Where to find:**
1. Go to **Settings** → **Database**
2. Under **Connection string**, select **URI**
3. Copy the string
4. **Important:** Replace `[YOUR-PASSWORD]` with your actual database password
5. The password is the one you set when creating the project

**Format breakdown:**
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

---

### 4. Session Secret

#### SESSION_SECRET
```env
SESSION_SECRET=8xK2mP9vQ4wL7nE3jR6tY0uH5gF1dS8zX
```

**How to generate:**

Option A - Using our script:
```bash
./generate-secret.sh
```

Option B - Using OpenSSL directly:
```bash
openssl rand -base64 32
```

Option C - Using Node.js:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Requirements:**
- At least 32 characters
- Should be random and unique
- Keep it secret!

---

### 5. Twilio WhatsApp Configuration

#### TWILIO_ACCOUNT_SID
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Where to find:**
1. Go to [console.twilio.com](https://console.twilio.com)
2. Your Account SID is on the dashboard home page
3. Starts with `AC`

---

#### TWILIO_AUTH_TOKEN
```env
TWILIO_AUTH_TOKEN=your_auth_token_here
```

**Where to find:**
1. Same dashboard page as Account SID
2. Click "Show" to reveal the Auth Token
3. ⚠️ Keep this secret!

---

#### TWILIO_WHATSAPP_NUMBER
```env
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

**For Testing (Sandbox):**
- Use: `whatsapp:+14155238886`
- Join sandbox: Messaging → Try it out → Send WhatsApp message

**For Production:**
- Use your approved WhatsApp Business number
- Format: `whatsapp:+1234567890`

---

#### TWILIO_WEBHOOK_SECRET
```env
TWILIO_WEBHOOK_SECRET=your-webhook-secret
```

**What it is:** A secret you create for webhook validation  
**How to generate:** Same as SESSION_SECRET
```bash
openssl rand -base64 32
```

---

### 6. OpenAI Configuration (Optional but recommended)

#### OPENAI_API_KEY
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
```

**Where to find:**
1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Copy the key immediately (can't view it again)
4. Starts with `sk-`

**What it's used for:**
- AI-powered expense categorization
- Natural language processing for WhatsApp messages
- Cost tracking in `ai_usage_log` table

**Cost:** Pay-as-you-go, typically $0.002 per 1K tokens  
**Can skip:** Yes, but AI features won't work

---

### 7. Optional Configuration

#### N8N_WEBHOOK_SECRET (Optional)
```env
N8N_WEBHOOK_SECRET=your-n8n-secret
```

**Only needed if:** You're using n8n for workflow automation  
**Can skip:** Yes, if using Twilio directly

---

#### FRONTEND_URL
```env
FRONTEND_URL=http://localhost:5000
```

**When to change:**
- Keep as `http://localhost:5000` for local development
- Change to your production domain when deploying
- Example: `https://myapp.com`

---

## ✅ Validation Checklist

After setting up your `.env` file:

```bash
# Test database connection
npm run test:db

# Should show:
# ✅ Database connection successful!
# ✅ All required tables exist!
```

If you see errors, check:
- [ ] All required variables are set
- [ ] No spaces around `=` signs
- [ ] DATABASE_URL password is correct (no brackets)
- [ ] Supabase project is active

---

## 🔒 Security Best Practices

1. **Never commit `.env` to Git**
   - Already in `.gitignore`
   - Double-check: `git status` shouldn't show `.env`

2. **Different secrets for each environment**
   - Development: Use test keys
   - Production: Generate new secrets

3. **Rotate secrets regularly**
   - Change SESSION_SECRET every 90 days
   - Rotate API keys if compromised

4. **Service role key protection**
   - NEVER use in frontend code
   - Only in server-side operations
   - Grants admin access to database

---

## 🚀 Quick Start Commands

```bash
# 1. Copy example
cp .env.example .env

# 2. Generate session secret
./generate-secret.sh

# 3. Edit .env with your values
nano .env

# 4. Test configuration
npm run test:db

# 5. Start development
npm run dev
```

---

## 📚 Related Documentation

- **Supabase Setup:** See `README.md` section "Supabase Setup"
- **Twilio Setup:** See `README.md` section "Twilio WhatsApp Setup"
- **Full Guide:** See `QUICK_START.md` for step-by-step setup

---

## 🆘 Troubleshooting

### "DATABASE_URL must be set"
**Problem:** .env file not found or DATABASE_URL missing  
**Solution:** 
```bash
# Check if .env exists
ls -la .env

# If not, create it
cp .env.example .env
```

### "Cannot connect to database"
**Problem:** Wrong DATABASE_URL or password  
**Solution:**
1. Verify password in Supabase dashboard
2. Copy connection string again
3. Ensure no extra spaces in .env

### "Twilio is not configured"
**Problem:** Missing Twilio credentials  
**Solution:** This is just a warning. Add credentials when ready for WhatsApp.

### "Invalid Supabase credentials"
**Problem:** Wrong API keys  
**Solution:**
1. Go to Supabase → Settings → API
2. Copy keys again
3. Make sure you're copying from correct project

---

**Last Updated:** January 2026  
**For Support:** See main README.md or run `npm run test:db` for diagnostics


