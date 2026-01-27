# 🚀 Quick Start Guide - BuildMonitor Backend

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (or Supabase account)
- Twilio account with WhatsApp enabled
- Git

## 1. Clone & Install

```bash
cd /Users/cipher/Downloads/BuildMonitor
npm install
```

## 2. Environment Setup

Create `.env` file in the project root:

```bash
# Copy from example
cp .env.example .env

# Or create new
touch .env
```

Add these variables to `.env`:

```bash
# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Session Security
SESSION_SECRET=<run: ./generate-secret.sh to generate>

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Optional
OWNER_WHATSAPP_NUMBER=+256770000000
DASHBOARD_URL=http://localhost:5000
NODE_ENV=development
PORT=5000
```

### Generate SESSION_SECRET

```bash
chmod +x generate-secret.sh
./generate-secret.sh
# Copy the output and paste into .env
```

## 3. Database Setup

Your Supabase database already has the schema deployed. Just verify:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should see:
-- profiles
-- projects
-- expenses
-- expense_categories
-- tasks
-- images
-- whatsapp_messages
-- ai_usage_log
-- sessions (auto-created by express-session)
```

### Seed Default Categories (Optional)

```bash
# Edit seed-categories.sql and replace YOUR_USER_ID
# Then run in Supabase SQL Editor or:
psql $DATABASE_URL < seed-categories.sql
```

## 4. Test Database Connection

```bash
npm run test:db
```

Expected output:
```
✅ Drizzle ORM connected successfully to PostgreSQL.
✅ Supabase client connected successfully.
✅ Fetched 0 existing profiles.
✅ Fetched 0 existing projects.
...
🎉 All database connection tests passed!
```

## 5. Start Development Server

```bash
npm run dev
```

Expected output:
```
🚀 BuildMonitor server running on port 5000
📊 Environment: development
🔐 Session store: PostgreSQL
💬 WhatsApp webhook: /webhook/webhook
🌐 API endpoint: /api
```

## 6. Test API Endpoints

### Test Authentication

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"owner","password":"owner123"}' \
  -c cookies.txt

# Get current user
curl -X GET http://localhost:5000/api/auth/me \
  -b cookies.txt
```

### Test Dashboard

```bash
curl -X GET http://localhost:5000/api/dashboard/summary \
  -b cookies.txt
```

### Test Expenses

```bash
# Create expense
curl -X POST http://localhost:5000/api/expenses \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "description": "Test cement purchase",
    "amount": 500,
    "expenseDate": "2025-01-25"
  }'

# Get expenses
curl -X GET http://localhost:5000/api/expenses \
  -b cookies.txt
```

## 7. Test WhatsApp Integration

### Setup ngrok (for local testing)

```bash
# Install ngrok
npm install -g ngrok

# Start ngrok in new terminal
ngrok http 5000
```

You'll get a URL like: `https://xxxx-xx-xxx.ngrok.io`

### Configure Twilio Webhook

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Messaging** → **Settings** → **WhatsApp Sandbox**
3. Set webhook URL to: `https://xxxx-xx-xxx.ngrok.io/webhook/webhook`
4. Set HTTP method to **POST**
5. Save

### Send Test Message

Send WhatsApp message to your Twilio sandbox number:

```
spent 500 on cement
```

Expected reply:
```
✅ Expense recorded!

📝 cement
💰 UGX 500
📊 Project: [Your Project]

💵 Remaining budget: UGX X,XXX
```

## 8. Access Frontend

Open browser: `http://localhost:5000`

The Vite dev server will serve the React frontend with hot reload.

## 9. Common Issues & Solutions

### Issue: "DATABASE_URL must be set"
**Solution**: Check `.env` file exists and has `DATABASE_URL`

### Issue: "SESSION_SECRET must be set in production"
**Solution**: Generate secret with `./generate-secret.sh` and add to `.env`

### Issue: "User not found" after login
**Solution**: 
1. Register a user via dashboard first
2. Or update `OWNER_WHATSAPP_NUMBER` in `.env` to match existing user

### Issue: "No active project found"
**Solution**: Create a project in the dashboard with status "active"

### Issue: Port 5000 already in use
**Solution**: 
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Or use different port
PORT=5001 npm run dev
```

### Issue: Twilio webhook not receiving messages
**Solution**:
1. Check ngrok is running
2. Verify webhook URL in Twilio console
3. Check server logs for errors

## 10. Development Workflow

### File Structure
```
BuildMonitor/
├── server/
│   ├── index.ts          # Entry point (updated)
│   ├── db.ts             # Database connection
│   ├── routes/
│   │   ├── api.ts        # NEW: REST API endpoints
│   │   └── whatsapp.ts   # NEW: WhatsApp webhook
│   ├── services/
│   │   └── intentParser.ts  # NEW: Intent detection
│   └── lib/
│       └── supabase.ts   # NEW: Supabase helpers
├── shared/
│   └── schema.ts         # Database schema (Drizzle)
└── client/
    └── src/              # React frontend
```

### Making Changes

1. **Add new API endpoint**: Edit `server/routes/api.ts`
2. **Update schema**: Edit `shared/schema.ts`, then run `npm run db:push`
3. **Add intent pattern**: Edit `server/services/intentParser.ts`
4. **Update frontend**: Edit files in `client/src/`

### Hot Reload
- Backend: Uses `tsx` watch mode (auto-restarts on changes)
- Frontend: Uses Vite HMR (instant updates)

## 11. Testing Checklist

- [ ] Server starts without errors
- [ ] Database connection successful
- [ ] Login works (POST /api/auth/login)
- [ ] Dashboard shows metrics (GET /api/dashboard/summary)
- [ ] Can create expense (POST /api/expenses)
- [ ] Can create task (POST /api/tasks)
- [ ] WhatsApp webhook receives messages
- [ ] Intent parser detects expenses correctly
- [ ] Frontend loads and displays data

## 12. Deploy to Production

See `SETUP_READY.md` for complete deployment checklist.

**Key Steps:**
1. Set `NODE_ENV=production`
2. Set all environment variables in production
3. Run `npm run build`
4. Start with `npm start`
5. Configure reverse proxy (nginx)
6. Set up SSL certificate
7. Configure Twilio production webhook

## 13. Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run check            # TypeScript type checking
npm run test:db          # Test database connection

# Production
npm run build            # Build for production
npm start                # Start production server

# Database
npm run db:push          # Push schema changes
npm run db:generate      # Generate migrations

# Utilities
./generate-secret.sh     # Generate SESSION_SECRET
```

## 14. API Documentation

See `API_DOCUMENTATION.md` for complete API reference.

**Quick Links:**
- Authentication: `POST /api/auth/login`
- Dashboard: `GET /api/dashboard/summary`
- Expenses: `GET /api/expenses`, `POST /api/expenses`
- Tasks: `GET /api/tasks`, `POST /api/tasks`
- WhatsApp: `POST /webhook/webhook`

## 15. WhatsApp Testing

See `WHATSAPP_TESTING.md` for complete testing guide.

**Quick Test Commands:**
```
spent 500 on cement       # Log expense
task: inspect foundation  # Create task
set budget 1000000        # Set budget
how much did I spend?     # Query expenses
```

## 16. Get Help

- **API Issues**: Check `API_DOCUMENTATION.md`
- **WhatsApp Issues**: Check `WHATSAPP_INTEGRATION.md`
- **Database Issues**: Check `shared/schema.ts`
- **Environment Issues**: Check `.env.example`

## 17. Next Steps

1. ✅ Complete API testing
2. ✅ Test WhatsApp integration
3. ✅ Connect frontend to backend
4. ✅ Test full user flow
5. ✅ Deploy to production

---

**Ready to build!** 🚀

If you encounter any issues, check the logs in the terminal and verify your `.env` configuration.


