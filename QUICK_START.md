# Quick Start Guide - Construction Monitor

Get your Construction Monitor app running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier is fine)
- A Twilio account (free trial is fine)

## Step-by-Step Setup

### 1. Install Dependencies (1 minute)

```bash
npm install
```

### 2. Create Supabase Project (2 minutes)

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose a name, database password, and region
4. Wait ~2 minutes for provisioning

### 3. Configure Environment (1 minute)

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and add your credentials:

**From Supabase Dashboard:**
- Go to Project Settings → API
- Copy `Project URL` → paste as `SUPABASE_URL`
- Copy `anon public` key → paste as `SUPABASE_ANON_KEY`
- Copy `service_role` key → paste as `SUPABASE_SERVICE_ROLE_KEY`

**From Supabase Database Settings:**
- Go to Project Settings → Database → Connection string → URI
- Copy the connection string
- Replace `[YOUR-PASSWORD]` with your database password
- Paste as `DATABASE_URL`

**Twilio (Optional for now):**
- Get from [twilio.com/console](https://www.twilio.com/console)
- You can skip this initially and add it later

### 4. Set Up Database (1 minute)

```bash
# Push database schema to Supabase
npm run db:push
```

When prompted, confirm with `yes`.

### 5. Test Everything

```bash
# Test database connection
npm run test:db
```

You should see:
```
✅ Database connection successful!
✅ All required tables exist!
🎉 Database is ready to use!
```

### 6. Run the Application

```bash
# Start development server
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

You should see the Construction Monitor dashboard! 🎉

## What's Next?

### Seed Default Data

Run this SQL in Supabase SQL Editor to create default expense categories:

```sql
INSERT INTO expense_categories (name, description, color, icon, is_default) VALUES
  ('Materials', 'Construction materials and supplies', '#3B82F6', 'hammer', true),
  ('Labor', 'Worker wages and contractor fees', '#10B981', 'users', true),
  ('Equipment', 'Tools and machinery rental', '#F59E0B', 'wrench', true),
  ('Transport', 'Transportation and delivery', '#8B5CF6', 'truck', true),
  ('Other', 'Miscellaneous expenses', '#6B7280', 'more-horizontal', true);
```

### Set Up WhatsApp (Optional)

1. Get Twilio credentials from [twilio.com/console](https://www.twilio.com/console)
2. Join WhatsApp Sandbox: Messaging → Try it out → Send a WhatsApp message
3. Add credentials to `.env`:
   ```
   TWILIO_ACCOUNT_SID=your-account-sid
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   ```
4. Restart the server: `npm run dev`

### Set Up Webhook (For WhatsApp)

For local development, use ngrok:

```bash
# Install ngrok
npm install -g ngrok

# Start ngrok
ngrok http 5000
```

Copy the HTTPS URL and set it in Twilio Console:
- Go to Messaging → Settings → WhatsApp Sandbox Settings
- "When a message comes in": `https://your-ngrok-url.ngrok.io/api/webhooks/twilio/whatsapp`

## Troubleshooting

### Database Connection Error

```bash
# Check your DATABASE_URL is correct
cat .env | grep DATABASE_URL

# Test connection
npm run test:db
```

### "Table doesn't exist" Error

```bash
# Push schema again
npm run db:push
```

### Port 5000 Already in Use

```bash
# Change port in .env
echo "PORT=3000" >> .env
```

### Can't Connect to Supabase

1. Check your Supabase project is not paused
2. Verify your IP is allowed in Supabase → Settings → Database → Connection pooling
3. Test with direct connection: `psql "postgresql://postgres:..."`

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run check        # Type check
npm run db:push      # Push schema to database
npm run db:generate  # Generate migration files
npm run test:db      # Test database connection
```

## Support

- 📖 See `README.md` for detailed documentation
- 🔧 See `MIGRATION_GUIDE.md` for advanced setup
- 🐛 Check the console logs for errors

## Success Checklist

- [ ] `npm install` completed successfully
- [ ] `.env` file created with all credentials
- [ ] `npm run test:db` shows all green checkmarks
- [ ] `npm run dev` starts without errors
- [ ] Browser shows dashboard at http://localhost:5000
- [ ] Can create a project in the UI
- [ ] Database has default expense categories

Once all items are checked, you're ready to start tracking expenses! 🚀


