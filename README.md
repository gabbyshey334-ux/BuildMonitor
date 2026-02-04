# JengaTrack Uganda 🏗️🇺🇬

A **WhatsApp-based expense tracking system** for Ugandan contractors built with React, Express, Supabase, and Twilio.

Track construction expenses, manage tasks, and monitor budgets—all from WhatsApp or the web dashboard.

---

## 🚀 Features

- **📱 WhatsApp Integration** - Log expenses via WhatsApp messages (English & Luganda)
- **💰 Budget Tracking** - Real-time budget monitoring with color-coded alerts
- **📊 Dashboard** - Beautiful web dashboard with charts and summaries
- **✅ Task Management** - Create and track construction tasks
- **🗂️ Categories** - Organize expenses by Materials, Labor, Equipment, Transport, etc.
- **🔐 Secure** - Row-level security with Supabase
- **📸 Photo Support** - Attach receipts and site photos
- **🌍 Multi-language** - English and Luganda support

---

## 🛠️ Tech Stack

### Frontend
- **React 18** + TypeScript
- **Vite** (build tool)
- **shadcn/ui** (UI components)
- **Tailwind CSS** (styling)
- **React Query** (data fetching)
- **React Hook Form** + Zod (forms & validation)

### Backend
- **Express.js** (API server)
- **Node.js** (runtime)
- **Drizzle ORM** (type-safe database queries)
- **express-session** (authentication)

### Database
- **Supabase** (PostgreSQL with RLS)
- **8 tables**: profiles, projects, expenses, tasks, categories, images, messages, ai_usage_log

### Integrations
- **Twilio** (WhatsApp API)
- **OpenAI** (AI fallback for unknown intents)

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** 18+ and npm/yarn
- **Supabase account** (free tier works)
- **Twilio account** with WhatsApp sandbox or approved number
- **OpenAI API key** (optional, for AI features)
- **PostgreSQL** database (via Supabase)

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd JengaTrack
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (from Supabase)
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# OpenAI (optional)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Session
SESSION_SECRET=your-random-32-char-secret

# Server
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173
```

**Generate a secure SESSION_SECRET:**

```bash
./generate-secret.sh
```

### 4. Push Database Schema

```bash
npm run db:push
```

This creates all tables in your Supabase database.

### 5. Seed Test Data (Optional)

```bash
npm run seed
```

This creates:
- Test user profile
- Default project (UGX 10M budget)
- 5 expense categories
- 5 sample expenses

### 6. Start the Development Server

```bash
npm run dev
```

The server will start on `http://localhost:5000` and the frontend on `http://localhost:5173`.

### 7. Login to Dashboard

Open `http://localhost:5173` and login with:

- **Username:** `owner`
- **Password:** `owner123`

---

## 🧪 Testing

### Test Environment Variables

```bash
npm run test:env
```

Checks if all required environment variables are set and validates their format.

### Test Database Connection

```bash
npm run test:db
```

Verifies database connectivity and performs basic operations.

### Test Health Endpoint

```bash
npm run test:health
```

Tests the `/health` endpoint to check server status.

### Run All Tests

```bash
npm run test:all
```

Runs all tests in sequence.

---

## 📱 Testing WhatsApp Integration

### Option 1: Twilio Sandbox (Quick Test)

1. **Join Twilio WhatsApp Sandbox:**
   - Go to [Twilio Console > Messaging > Try it out > Send a WhatsApp message](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
   - Send "join <your-sandbox-name>" to the Twilio WhatsApp number

2. **Expose Local Server with ngrok:**

```bash
# Install ngrok
npm install -g ngrok

# Expose port 5000
ngrok http 5000
```

3. **Configure Twilio Webhook:**
   - Copy the ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`)
   - Go to Twilio Console > Messaging > Settings > WhatsApp Sandbox Settings
   - Set "When a message comes in" to: `https://abc123.ngrok.io/webhook/webhook`

4. **Test Messages:**

```
spent 50000 on cement
task: inspect foundation
set budget 2000000
how much did I spend?
```

### Option 2: Production Twilio Number

1. Request a Twilio WhatsApp-enabled number
2. Deploy your app (see Deployment section)
3. Configure webhook URL in Twilio Console
4. Send messages from any WhatsApp number

---

## 🗄️ Database Schema

### Tables

1. **profiles** - User accounts (linked to auth.users)
2. **projects** - Construction projects
3. **expense_categories** - Expense categories (Materials, Labor, etc.)
4. **expenses** - Expense records
5. **tasks** - Task management
6. **images** - Receipt/photo storage
7. **whatsapp_messages** - Audit log of WhatsApp interactions
8. **ai_usage_log** - OpenAI API usage tracking

### Row-Level Security (RLS)

- ✅ Enabled on all tables
- ✅ Users can only see their own data
- ✅ Filtered by `user_id`

### Soft Deletes

All tables use `deleted_at` column for soft deletes (no hard deletions).

---

## 🌍 Environment Variables Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://abc.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon/public key (JWT) | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (JWT) | `eyJ...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | `ACxxxx...` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | `xxx...` |
| `TWILIO_WHATSAPP_NUMBER` | Twilio WhatsApp number | `whatsapp:+1415...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-xxx...` |
| `SESSION_SECRET` | Session encryption key (32+ chars) | Random string |
| `NODE_ENV` | Environment | `development` or `production` |
| `PORT` | Server port | `5000` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:5173` |

---

## 🚀 Deployment

### Deploy to Replit

1. **Create New Repl:**
   - Go to [Replit](https://replit.com)
   - Click "Create Repl"
   - Select "Import from GitHub"
   - Paste your repository URL

2. **Set Environment Variables:**
   - Click "Secrets" (lock icon) in left sidebar
   - Add all required environment variables from `.env`

3. **Configure Run Command:**
   - Open `.replit` file
   - Set run command: `npm run build && npm start`

4. **Deploy:**
   - Click "Run" to start the server
   - Replit will automatically deploy

5. **Get Deployment URL:**
   - Copy the Repl URL (e.g., `https://your-repl.your-username.repl.co`)
   - Update `FRONTEND_URL` in Secrets

6. **Configure Twilio Webhook:**
   - Set webhook URL to: `https://your-repl.your-username.repl.co/webhook/webhook`

### Deploy to Other Platforms

The app can be deployed to:
- **Vercel** (frontend) + **Railway** (backend)
- **Heroku**
- **DigitalOcean App Platform**
- **AWS Elastic Beanstalk**

**Build Commands:**
```bash
npm run build     # Build both frontend and backend
npm start         # Start production server
```

---

## 📚 API Documentation

See [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) for complete API reference.

### Key Endpoints

- **Authentication:**
  - `POST /api/auth/login` - Login
  - `POST /api/auth/logout` - Logout
  - `GET /api/auth/me` - Get current user

- **Dashboard:**
  - `GET /api/dashboard/summary` - Budget summary

- **Expenses:**
  - `GET /api/expenses` - List expenses
  - `POST /api/expenses` - Create expense
  - `PUT /api/expenses/:id` - Update expense
  - `DELETE /api/expenses/:id` - Delete expense

- **Tasks:**
  - `GET /api/tasks` - List tasks
  - `POST /api/tasks` - Create task
  - `PUT /api/tasks/:id` - Update task
  - `DELETE /api/tasks/:id` - Delete task

- **Categories:**
  - `GET /api/categories` - List categories

- **Images:**
  - `GET /api/images` - List images
  - `POST /api/images` - Upload image

- **WhatsApp Webhook:**
  - `POST /webhook/webhook` - Twilio webhook

- **Health Check:**
  - `GET /health` - Server health status

---

## 🤝 WhatsApp Intent Examples

The system understands natural language messages in **English** and **Luganda**:

### Log Expenses
```
spent 50000 on cement
paid 200 for bricks
bought sand 150
nimaze 300 ku sand (Luganda)
```

### Create Tasks
```
task: inspect foundation
add task: order roofing materials
todo: check concrete quality
```

### Set Budget
```
set budget 2000000
budget is 1500000
my budget 3000000
```

### Query Expenses
```
how much did I spend?
total spent
what's my budget?
show my expenses
```

### Send Image with Caption
```
[Attach photo]
receipt for cement
site progress today
```

---

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Test database connection
npm run test:db

# Check environment variables
npm run test:env
```

### Twilio Webhook Not Working

1. Check ngrok is running: `ngrok http 5000`
2. Verify webhook URL in Twilio Console
3. Check server logs for errors
4. Test webhook with curl:

```bash
curl -X POST http://localhost:5000/webhook/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+256700000000&Body=test message"
```

### Session/Auth Issues

1. Check `SESSION_SECRET` is set
2. Clear browser cookies
3. Restart server
4. Check database `sessions` table exists

### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

---

## 📝 Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run check` | TypeScript type checking |
| `npm run db:push` | Push schema to database |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run test:env` | Test environment variables |
| `npm run test:db` | Test database connection |
| `npm run test:health` | Test health endpoint |
| `npm run test:all` | Run all tests |
| `npm run seed` | Seed test data |

---

## 📖 Documentation

- [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) - Complete API reference
- [`WHATSAPP_INTEGRATION.md`](./WHATSAPP_INTEGRATION.md) - WhatsApp setup guide
- [`SCHEMA_LOCKED.md`](./SCHEMA_LOCKED.md) - Database schema documentation
- [`AUTH_HOOK_UPDATED.md`](./AUTH_HOOK_UPDATED.md) - Authentication system guide
- [`DASHBOARD_UPDATED.md`](./DASHBOARD_UPDATED.md) - Dashboard implementation guide
- [`ADD_EXPENSE_FORM_COMPLETE.md`](./ADD_EXPENSE_FORM_COMPLETE.md) - Manual expense form guide

---

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Push notifications
- [ ] Multiple projects per user
- [ ] Team collaboration
- [ ] Advanced analytics
- [ ] Budget forecasting
- [ ] Supplier management
- [ ] Invoice generation
- [ ] Export to PDF/Excel
- [ ] Multi-currency support

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 💬 Support

For questions or issues:
- Open an issue on GitHub
- Email: support@jengatrack.ug (example)
- WhatsApp: +256 XXX XXX XXX (example)

---

## 🙏 Acknowledgments

- **shadcn/ui** for beautiful UI components
- **Supabase** for database and auth
- **Twilio** for WhatsApp API
- **Drizzle ORM** for type-safe database queries
- **React Query** for data fetching

---

**Built with ❤️ for Ugandan contractors 🇺🇬**

