# Backend - Construction Monitor Uganda

Express.js backend with PostgreSQL database and Telegram bot integration.

## 🚀 Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file with:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/construction_monitor
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   SESSION_SECRET=your_session_secret
   ```

3. **Set up database:**
   ```bash
   npm run db:push
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

## 📁 File Structure

```
├── db.ts              # Database connection
├── index.ts           # Server entry point
├── routes.ts          # API endpoints
├── storage.ts         # Database operations
├── replitAuth.ts      # Authentication middleware
├── bot.js             # Telegram bot
├── shared/            # Shared types and schemas
└── vite.ts            # Development server setup
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run db:push` - Push schema to database
- `npm run db:studio` - Open database studio (if available)

## 🔗 API Endpoints

- `GET /api/auth/user` - Get current user
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `POST /api/bot/submit-update` - Telegram bot updates
- And many more...

## 🤖 Telegram Bot

The bot file (`bot.js`) handles:
- Manager registration
- Daily reminders
- Project updates with photos
- Real-time notifications