# JengaTrack (BuildMonitor)

Construction project tracking through **WhatsApp** and a **web dashboard**: expenses, materials, daily logs, budgets, and AI-assisted updates.

## Features

- WhatsApp updates via Twilio (text, media, voice)
- Supabase (PostgreSQL) for data
- Vite + React dashboard
- Serverless API on Vercel (`api/`)

## Tech stack

| Area        | Technology                          |
|------------|--------------------------------------|
| Frontend   | React, TypeScript, Vite, Tailwind    |
| API        | Node, Express-style handlers, Vercel  |
| Database   | Supabase                            |
| WhatsApp   | Twilio                              |
| AI         | Google Gemini, OpenAI (configurable) |

## Prerequisites

- Node 18+
- npm
- Supabase project and service role key
- Twilio account (WhatsApp sender)
- Vercel (or another host) for production

## Setup

```bash
git clone https://github.com/gabbyshey334-ux/BuildMonitor.git
cd BuildMonitor
npm install
```

Copy `.env.example` to `.env` (or use your host’s env UI) and set at least:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`
- `GEMINI_API_KEY` and/or `OPENAI_API_KEY` (for the assistant)
- `DASHBOARD_URL` (public app URL, used in messages)

## Build

```bash
npm run build
```

This runs the Vite client build and `node build-api.js`, which compiles `api/_whatsapp-webhook.ts` → `api/whatsapp-webhook.js` and the daily heartbeat handler. **Commit the generated `api/*.js` files** so Vercel can match `vercel.json` `functions` patterns (see troubleshooting guide).

## Deploy (Vercel)

- Connect the GitHub repo and use the `main` branch.
- Set the same environment variables in the Vercel project.
- Build command: `npm run build` (default in `vercel.json`).
- Point your Twilio WhatsApp sandbox/production webhook to:  
  `https://<your-domain>/api/whatsapp-webhook`  
  (or the path you use in `vercel.json` rewrites).

## Documentation

- **[TROUBLESHOOTING GUIDE.md](./TROUBLESHOOTING_GUIDE.md)** — WhatsApp bot, Vercel deploy, and dashboard issues.

## License

MIT (see `package.json`).
