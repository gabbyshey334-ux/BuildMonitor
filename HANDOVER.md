# JengaTrack — Complete Handover Document

## 1. What Is JengaTrack

WhatsApp-to-dashboard construction management app. Site managers send WhatsApp messages to log expenses, materials, workers, and progress. Everything flows into a live web dashboard.

---

## 2. Live URLs

- **App:** https://build-monitor-lac.vercel.app (will change to jengatrack.com)
- **GitHub:** https://github.com/gabbyshey334-ux/BuildMonitor
- **Vercel:** https://vercel.com/dashboard
- **Supabase:** https://supabase.com/dashboard
- **Twilio:** https://console.twilio.com

---

## 3. Tech Stack

| Tool       | Purpose              | Cost              |
|-----------|----------------------|-------------------|
| Vercel    | Hosting + API        | Free tier         |
| Supabase  | Database + Auth      | Free tier         |
| Twilio    | WhatsApp API         | Pay per message   |
| OpenAI    | NLP / receipt OCR    | Pay per use       |
| Namecheap | Domain (optional)    | ~$10/year         |

---

## 4. Architecture

```
WhatsApp Message
  → Twilio receives it
  → POST /api/whatsapp-webhook
  → Intent classified (GPT-4o-mini)
  → Data saved to Supabase
  → Dashboard auto-refreshes (e.g. 30s)
  → User sees update in browser
```

---

## 5. Environment Variables

| Variable                      | Description                                      | Example / Notes                    |
|------------------------------|--------------------------------------------------|------------------------------------|
| `SUPABASE_URL`               | Supabase project URL                             | `https://xxx.supabase.co`          |
| `SUPABASE_ANON_KEY`          | Public anon key (frontend)                       | From Supabase Settings → API      |
| `SUPABASE_SERVICE_ROLE_KEY`  | Admin key (server only, keep secret)             | From Supabase Settings → API      |
| `JWT_SECRET`                 | Random 32+ char string for dashboard auth       | Generate with `openssl rand -hex 32` |
| `TWILIO_ACCOUNT_SID`         | From Twilio Console                              | `ACxxxxxxxx...`                    |
| `TWILIO_AUTH_TOKEN`         | From Twilio Console                              | Keep secret                        |
| `TWILIO_WHATSAPP_NUMBER`    | WhatsApp sender number                           | `whatsapp:+14155238886`            |
| `OPENAI_API_KEY`            | From platform.openai.com                          | `sk-...`                           |
| `GEMINI_API_KEY`            | Optional fallback AI (Google AI Studio)           | For intent/OCR/voice if OpenAI fails |
| `DASHBOARD_URL`             | Public URL of the dashboard                      | `https://jengatrack.com`           |
| `CRON_SECRET`               | Random string for cron job auth (daily heartbeat)| Any random string                  |
| `NODE_ENV`                  | Environment                                      | `production`                       |

---

## 6. How to Deploy

1. Push code to the `main` branch of the GitHub repo.
2. In Vercel: Import project from GitHub (or connect existing).
3. In Vercel → Project → Settings → Environment Variables: add every variable from Section 5 for Production (and Preview if needed).
4. Trigger a deploy (e.g. “Redeploy” from Deployments, or push to `main`).
5. In Twilio Console → Messaging → WhatsApp Sandbox (or your number) → set “When a message comes in” to `https://<your-vercel-url>/api/whatsapp-webhook` (POST).
6. In Supabase: ensure RLS and tables match the app (see Section 8).

---

## 7. How to Run Locally

1. Clone the repo: `git clone https://github.com/gabbyshey334-ux/BuildMonitor.git && cd BuildMonitor`
2. Install: `npm install`
3. Copy env: `cp .env.example .env` and fill in real values (use a separate Supabase project or dev keys).
4. Build API (compiles webhook): `node build-api.js`
5. Start client: `npm run build:client` then serve `dist/public`, or use a dev server that proxies `/api` to a running API.
6. For full local API: run the Express server (see `package.json` scripts) and point the client at it.
7. For WhatsApp testing: use ngrok to expose your local server and set Twilio webhook to the ngrok URL + `/api/whatsapp-webhook`.

---

## 8. Database Tables

| Table                | Purpose                                      |
|----------------------|----------------------------------------------|
| `profiles`           | User accounts (dashboard + WhatsApp users)   |
| `projects`           | Construction projects (reference `profiles.id`) |
| `expenses`           | All logged expenses (reference `projects`, `profiles`) |
| `daily_logs`         | Daily site updates (workers, notes, photos)  |
| `materials_inventory`| Stock tracking per project                   |
| `vendors`            | Supplier records per project                 |
| `tasks`              | Issues/tasks per project                     |

---

## 9. WhatsApp Bot Commands

Users can say (or equivalent in supported languages):

- **Expenses:** “Bought 50 bags cement for 1,900,000”, “Paid plumber 150k”
- **Materials:** “Received 50 bags cement”, “Used 5 bags cement”
- **Labor:** “8 workers on site today”
- **Progress:** “Foundation 80% complete”
- **Budget:** “How much have we spent?”, “What’s left in budget?”
- **Materials query:** “How much cement do we have?”
- **Weather:** “Heavy rain, no work today”
- **Switch project:** “Switch project”
- **Greeting / menu:** “Hi”, “Menu”, “Help”
- **Media:** Send receipt photo (OCR) or voice note (transcription then intent)

---

## 10. Common Admin Tasks

- **Reset a user’s bot state:** Run the “Reset a user’s bot state” query in `scripts/admin-queries.sql` (replace phone number).
- **View all projects:** Use “View all projects” in `scripts/admin-queries.sql`.
- **Manually add an expense:** In Supabase SQL or Table Editor, insert into `expenses` with correct `project_id`, `user_id`, `amount`, `description`, `expense_date`, `currency`, `source`.
- **Check error logs:** Vercel → Project → Logs / Functions; Supabase → Logs.
- **Redeploy after code changes:** Push to `main` or click “Redeploy” in Vercel.

---

## 11. Monthly Cost Estimate

- **0–50 users:** ~$5–15/month (Twilio + OpenAI light use)
- **50–200 users:** ~$20–60/month
- **200–500 users:** ~$60–150/month

Vercel and Supabase free tiers apply until usage exceeds limits.

---

## 12. Support Contacts

- **Vercel:** https://vercel.com/support
- **Supabase:** https://supabase.com/support
- **Twilio:** https://www.twilio.com/help/contact
- **OpenAI:** https://help.openai.com

---

## 13. Known Issues & Fixes

- **POST /api/projects 400 “User does not exist”:** User check must use `profiles` table, not `users`. Fixed by verifying `profiles.id` before creating a project.
- **WhatsApp project creation FK violation:** `projects.user_id` must be `profiles.id`. Ensure `createProjectFromOnboarding` uses the same `userId` from `getUserProfile()` and that the profile exists before insert.
- **Webhook 404:** Ensure `vercel.json` rewrites send `/api/whatsapp-webhook` to the webhook function and that the built `api/whatsapp-webhook.js` exists (run `npm run build` which runs `build-api.js`).
- **Session / cookie missing:** App uses JWT only; token in `Authorization: Bearer <token>`. No session store required.
- **Budget showing wrong (e.g. 30B instead of 30M):** Budget input supports “30M”, “30,000,000”; parse with shared `parseBudget` on client and server.
