# JengaTrack 🏗️

> Manage construction projects via WhatsApp

## Features

- **WhatsApp-based expense logging** — “Bought 50 bags cement for 1,900,000”
- **Receipt OCR scanning** — Send a photo, get extracted totals and items
- **Voice note transcription** — Speak updates, we log them
- **Real-time dashboard** — Budget, expenses, materials, progress
- **Budget tracking** — Spent vs budget, alerts
- **Materials inventory** — Stock levels and usage
- **Daily accountability** — Workers on site, notes, photos
- **Trends & insights** — Burn rate, summaries
- **Multi-project support** — Switch projects via WhatsApp or dashboard
- **Group mode** — Owner + manager (when configured)
- **Dark/light theme** — UI theme toggle
- **3 languages** — English, Luganda, Portuguese

## Tech Stack

- **Frontend:** React + TypeScript + Tailwind + Vite
- **API:** Node.js + Express (Vercel serverless)
- **Database:** Supabase (PostgreSQL)
- **WhatsApp:** Twilio
- **AI:** OpenAI GPT-4o-mini (text), GPT-4o (receipt images)
- **Hosting:** Vercel

## Quick Start

1. Clone the repo: `git clone https://github.com/gabbyshey334-ux/BuildMonitor.git && cd BuildMonitor`
2. `npm install`
3. Copy `.env.example` to `.env` and fill in environment variables
4. `npm run build` (builds client + compiles API)
5. Run locally (see HANDOVER.md for full local setup) or deploy to Vercel

## Deployment

Push to the `main` branch → Vercel auto-deploys. Set all environment variables in the Vercel project settings.

See **HANDOVER.md** for full handover, env vars, database tables, and admin tasks.
