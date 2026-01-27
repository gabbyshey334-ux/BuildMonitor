# 🚀 Setup Checklist - Construction Monitor

Complete these steps in order to get your app running.

## ✅ Phase 1: Initial Setup (5 minutes)

### 1.1 Install Dependencies
```bash
cd BuildMonitor
npm install
```
- [ ] No errors during installation
- [ ] `node_modules` folder created

### 1.2 Create Supabase Project
1. Go to https://supabase.com
2. Sign up or log in
3. Click "New Project"
4. Choose:
   - Name: construction-monitor
   - Database Password: (save this!)
   - Region: closest to Uganda
5. Wait 2-3 minutes for provisioning

- [ ] Project created successfully
- [ ] Database password saved securely

### 1.3 Get Supabase Credentials
From your Supabase dashboard:

**Project Settings → API**
- [ ] Copy Project URL
- [ ] Copy `anon` public key
- [ ] Copy `service_role` secret key

**Project Settings → Database → Connection string → URI**
- [ ] Copy connection string
- [ ] Note: You'll replace `[YOUR-PASSWORD]` with your database password

## ✅ Phase 2: Configuration (2 minutes)

### 2.1 Create Environment File
```bash
cp .env.example .env
```

### 2.2 Edit .env File
Open `.env` in your editor and fill in:

```env
# Supabase (REQUIRED)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres

# Session (REQUIRED)
SESSION_SECRET=your-random-32-char-string-here

# Twilio (OPTIONAL for now)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=
```

- [ ] All Supabase variables filled in
- [ ] `[YOUR-PASSWORD]` replaced in DATABASE_URL
- [ ] SESSION_SECRET is a long random string

### 2.3 Verify .env File
```bash
cat .env | grep SUPABASE_URL
```
Should show your Supabase URL (not the example URL)

- [ ] .env file contains real credentials

## ✅ Phase 3: Database Setup (2 minutes)

### 3.1 Push Database Schema
```bash
npm run db:push
```

When prompted "Do you want to continue?", type `yes`

- [ ] Schema pushed successfully
- [ ] No errors reported

### 3.2 Test Database Connection
```bash
npm run test:db
```

Expected output:
```
✅ Database connection successful!
✅ All required tables exist!
🎉 Database is ready to use!
```

- [ ] All tests pass (green checkmarks)
- [ ] 8+ tables found
- [ ] No missing tables

### 3.3 Seed Default Data
Run this in Supabase SQL Editor (Dashboard → SQL Editor):

```sql
INSERT INTO expense_categories (name, description, color, icon, is_default) VALUES
  ('Materials', 'Construction materials', '#3B82F6', 'hammer', true),
  ('Labor', 'Worker wages', '#10B981', 'users', true),
  ('Equipment', 'Tools and machinery', '#F59E0B', 'wrench', true),
  ('Transport', 'Transportation', '#8B5CF6', 'truck', true),
  ('Other', 'Miscellaneous', '#6B7280', 'more-horizontal', true);
```

Or use the seed file:
```bash
# Copy content from seed-categories.sql
cat seed-categories.sql
# Paste in Supabase SQL Editor and run
```

- [ ] 5 expense categories created
- [ ] No SQL errors

## ✅ Phase 4: Run Application (1 minute)

### 4.1 Start Development Server
```bash
npm run dev
```

Expected output:
```
serving on port 5000
```

- [ ] Server starts without errors
- [ ] No "DATABASE_URL must be set" error
- [ ] No connection errors

### 4.2 Open in Browser
Visit: http://localhost:5000

- [ ] Dashboard loads successfully
- [ ] No 404 or 500 errors
- [ ] Can see the UI

### 4.3 Test Basic Functionality
In the browser:
1. Try creating a test project
2. Add a task to the project
3. Check if it saves

- [ ] Can create a project
- [ ] Can view project list
- [ ] Can add tasks
- [ ] Data persists after refresh

## ✅ Phase 5: WhatsApp Setup (Optional, 10 minutes)

### 5.1 Create Twilio Account
1. Go to https://www.twilio.com/try-twilio
2. Sign up (free trial available)
3. Verify your phone number

- [ ] Twilio account created
- [ ] Phone verified

### 5.2 Get Twilio Credentials
From Twilio Console (https://console.twilio.com):
- [ ] Copy Account SID
- [ ] Copy Auth Token

### 5.3 Join WhatsApp Sandbox
1. In Twilio Console: Messaging → Try it out → Send a WhatsApp message
2. Send the join code from your phone to the Twilio WhatsApp number
3. Wait for confirmation

- [ ] Joined WhatsApp sandbox
- [ ] Received welcome message

### 5.4 Add Twilio to .env
Edit `.env` and add:
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

- [ ] Credentials added to .env
- [ ] Server restarted: `npm run dev`

### 5.5 Set Up ngrok (for local testing)
```bash
# Install ngrok
npm install -g ngrok

# In a new terminal
ngrok http 5000
```

- [ ] ngrok running
- [ ] HTTPS URL visible (e.g., https://abc123.ngrok.io)

### 5.6 Configure Twilio Webhook
1. Go to Twilio Console → Messaging → Settings → WhatsApp Sandbox Settings
2. "When a message comes in" → paste: `https://YOUR_NGROK_URL/api/webhooks/twilio/whatsapp`
3. Method: POST
4. Save

- [ ] Webhook URL configured
- [ ] URL ends with `/api/webhooks/twilio/whatsapp`

### 5.7 Test WhatsApp
Send this message to your Twilio WhatsApp number:
```
help
```

Expected response:
```
📋 *Construction Monitor Commands:*
...
```

- [ ] Bot responds to messages
- [ ] Help command works
- [ ] Messages logged in database

## ✅ Phase 6: Verification

### 6.1 Health Check
```bash
curl http://localhost:5000/api/health
```

Expected:
```json
{
  "success": true,
  "status": "healthy",
  "database": "connected"
}
```

- [ ] Health check returns 200 OK
- [ ] Database status is "connected"

### 6.2 Database Check
Run in Supabase SQL Editor:
```sql
SELECT 
  (SELECT COUNT(*) FROM profiles) as profiles,
  (SELECT COUNT(*) FROM projects) as projects,
  (SELECT COUNT(*) FROM expense_categories) as categories,
  (SELECT COUNT(*) FROM whatsapp_messages) as messages;
```

- [ ] Query runs successfully
- [ ] Categories count is 5
- [ ] Can see table counts

### 6.3 Final Checklist
- [ ] Server runs: `npm run dev`
- [ ] Database connected: `npm run test:db`
- [ ] Browser works: http://localhost:5000
- [ ] Can create projects
- [ ] Can add tasks
- [ ] WhatsApp works (if configured)

## 🎉 You're Done!

If all checkboxes are ticked, your Construction Monitor is ready to use!

## 📚 Next Steps

1. **Read the docs**:
   - `README.md` - Full documentation
   - `QUICK_START.md` - Quick reference
   - `MIGRATION_GUIDE.md` - Advanced topics

2. **Customize**:
   - Add more expense categories
   - Create your first real project
   - Invite team members

3. **Deploy to production**:
   - See `README.md` deployment section
   - Use Railway, Render, or Fly.io
   - Configure production Twilio number

## ❌ Troubleshooting

### Issue: "DATABASE_URL must be set"
**Solution**: 
1. Check `.env` file exists
2. Verify DATABASE_URL is set
3. Restart server

### Issue: "Cannot connect to database"
**Solution**:
1. Check Supabase project is active
2. Verify connection string is correct
3. Run `npm run test:db` for details

### Issue: Tables don't exist
**Solution**:
```bash
npm run db:push
```

### Issue: WhatsApp not working
**Solution**:
1. Check Twilio credentials in `.env`
2. Verify webhook URL is correct
3. Check ngrok is running
4. Restart server

### Issue: Port 5000 in use
**Solution**:
Add to `.env`:
```
PORT=3000
```

## 🆘 Need Help?

- Check terminal logs for errors
- Run `npm run test:db` to diagnose issues
- Review `README.md` for details
- Verify all environment variables are set

---

**Last Updated**: January 2026
**Version**: 1.0.0


