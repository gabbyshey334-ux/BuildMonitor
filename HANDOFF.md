# JengaTrack (BuildMonitor) — Complete Handoff Document

**Date:** 2026-07-26  
**Product name:** JengaTrack  
**GitHub repo:** https://github.com/gabbyshey334-ux/BuildMonitor  
**Production domain:** https://jengatrack.com  
**Vercel (example):** https://build-monitor-lac.vercel.app / or-lac.vercel.app  
**Branch:** `main` (latest pushed: `2710bfc`)  
**Primary stack:** React + Vite + Tailwind · Express-style API on Vercel · Supabase (Postgres + Auth) · Twilio WhatsApp · Gemini/OpenAI

---

## 1. What this product is

JengaTrack lets construction teams track **projects, budgets, expenses, materials, daily logs, tasks, and issues** via:

1. **WhatsApp** (Twilio) — log expenses, materials, workers, issues, photos, voice by messaging a bot  
2. **Web dashboard** — projects list, project health dashboard, budget, materials, daily, trends, settings, help  

Users register on the web (Supabase Auth), optionally link a WhatsApp number, then message the bot to update the same Supabase data the dashboard reads.

---

## 2. Architecture (how traffic flows)

```
Browser (client/)  ──HTTPS──►  Vercel static (dist/public)
                              │
                              └── /api/*  ──►  api/index.js  ──►  Supabase
                              └── /api/whatsapp-webhook  ──►  api/whatsapp-webhook.js
                                          ▲
                                          │ POST (Twilio)
                                      Twilio WhatsApp
```

| Concern | Where it lives in production |
|--------|------------------------------|
| UI | Vite build → `dist/public`; SPA rewrite to `index.html` |
| REST API | `api/index.js` (single Express app as serverless) |
| WhatsApp | `api/whatsapp-webhook.js` (built from `api/_whatsapp-webhook.ts`) |
| Daily digests | Cron → `/api/daily-heartbeat` (`api/daily-heartbeat.js` from `_daily-heartbeat.ts`) |
| Auth | Supabase Auth + app JWT (`JWT_SECRET`) for API `Authorization: Bearer` |
| DB | Supabase Postgres; schema mirrored in `shared/schema.ts` |

**Important:** Source for the WhatsApp bot is `api/_whatsapp-webhook.ts` (underscore = not deployed as its own function). `build-api.js` compiles it to `api/whatsapp-webhook.js`, which **must be committed** so Vercel can run it.

Legacy `server/` is an older Express/Replit-style app. **Production path is `api/` + Vite client**, not `npm start` on `dist/server` unless you deliberately run that path.

---

## 3. Repository map (every top-level folder)

| Path | Role |
|------|------|
| `api/` | **Production serverless API** + WhatsApp webhook + utils + tests |
| `client/` | **Frontend** (React/Vite) — pages, components, contexts, hooks |
| `shared/` | Code shared by client + API (schema, money math, password policy, formatting) |
| `migrations/` | SQL to run in Supabase (schema evolution + RLS + indexes) |
| `scripts/` | One-off ops: seed, backups, user create, env/health checks |
| `server/` | Legacy Node/Express server (local `npm run dev`); not the Vercel primary path |
| `docs/` | Operational docs (security setup) |
| `.github/` | CI + Dependabot (**may be local-only** if token lacked `workflow` scope) |
| `public/` | Extra static images (also mirrored under `client/public`) |
| `attached_assets/` | Design / HTML prototypes |
| `dist/` | Build output (do not hand-edit) |
| `.cursor/` | Editor settings |
| `.config/`, `.local/` | Tooling / Replit leftovers — ignore for product handover |

---

## 4. Root config files

| File | Purpose |
|------|---------|
| `package.json` | Scripts & deps (`build`, `dev`, `test:unit`, `seed`, etc.) |
| `package-lock.json` | Locked dependency tree |
| `vercel.json` | Build, output dir, function timeouts, cron, URL rewrites |
| `vite.config.ts` | Vite + `@` / `@shared` aliases |
| `tailwind.config.ts` | Design tokens (Fresh Fern / Ocean Pine), breakpoints |
| `postcss.config.js` | PostCSS / Tailwind pipeline |
| `tsconfig.json` | TS include: client, shared, server |
| `tsconfig.build.json` | Server compile config |
| `drizzle.config.ts` | Drizzle → `./shared/schema.ts` |
| `components.json` | shadcn/ui config |
| `build-api.js` | Compiles `api/_*.ts` → `api/*.js` for Vercel |
| `.env.example` | Required env vars template (**copy to `.env`; never commit `.env`**) |
| `.env` | Local secrets (gitignored) |
| `README.md` | Quick start |
| `TROUBLESHOOTING_GUIDE.md` | Deploy / WhatsApp / dashboard debugging |
| `HANDOFF.md` | This document |
| `deploy-to-vercel.sh`, `push-to-github.sh`, `push-now.sh`, `setup-env.sh`, `generate-secret.sh` | Helper shell scripts |
| `generate-session-secret.js` | Session secret helper |
| `test-db.ts` | DB connectivity check |
| `construction_monitor_webapp.html` | Old HTML prototype |
| `project.sql`, `seed-categories.sql` | Ad-hoc SQL |

---

## 5. Environment variables (required for production)

From `.env.example` / `docs/SECURITY_SETUP.md`:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Client / password-reset flows |
| `SUPABASE_SERVICE_ROLE_KEY` | Server bypass RLS (API + webhook) |
| `JWT_SECRET` | Signs dashboard API JWTs (**required in production**) |
| `TWILIO_ACCOUNT_SID` | Twilio account |
| `TWILIO_AUTH_TOKEN` | Twilio auth + webhook signature |
| `TWILIO_WHATSAPP_NUMBER` | e.g. `whatsapp:+1...` |
| `WEBHOOK_PUBLIC_URL` | **Exact** public webhook URL (must match Twilio console) |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | AI intent, OCR, voice |
| `DASHBOARD_URL` | Links in WhatsApp messages |
| `ALLOWED_ORIGINS` | CORS allowlist |
| `CRON_SECRET` | Protect daily heartbeat |
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` |
| `ALERT_WEBHOOK_URL` | Optional 5xx alerts |
| `ENCRYPTION_KEY` | Optional field encryption |
| `SKIP_TWILIO_SIGNATURE` | **Local only** — never on Vercel production |

**Production Twilio + env (still pending access):**

```
WEBHOOK_PUBLIC_URL=https://jengatrack.com/api/whatsapp-webhook
```

Twilio console → Incoming WhatsApp webhook:

- URL: `https://jengatrack.com/api/whatsapp-webhook`  
- Method: **POST**  
- Must match `WEBHOOK_PUBLIC_URL` exactly (no trailing slash).

---

## 6. `api/` — production backend (folder-by-folder)

### 6.1 Entry / handlers

| File | Role |
|------|------|
| `api/index.js` | **Main API** (~4.8k lines). Auth, projects, expenses, materials, daily, tasks, issues, dashboard aggregates, waitlist. Mounted at `/api/*` via rewrite. |
| `api/_whatsapp-webhook.ts` | **Source of truth** for WhatsApp bot (~5.5k lines): intents, expenses, materials, issues, media, onboarding, AI tools. |
| `api/whatsapp-webhook.js` | **Deployed** compiled webhook (commit after `npm run build`). |
| `api/_whatsapp.ts` | Older/minimal WhatsApp stub (underscore = not a Vercel function). Prefer `_whatsapp-webhook.ts`. |
| `api/_daily-heartbeat.ts` | Cron job source: daily project digests. |
| `api/daily-heartbeat.js` | Compiled heartbeat handler. |

### 6.2 `api/utils/`

| File | Role |
|------|------|
| `jwt.js` | Sign/verify app JWTs; no unstable fallback in production |
| `authz.js` | Recovery-token age (30 min / 1800s), ownership helpers |
| `cors.js` | Allowed origins |
| `rateLimit.js` | API / auth rate limits |
| `sanitize.js` | Input sanitization |
| `rbac.js` | Project roles (owner / manager / linked profiles) |
| `twilioSignature.js` | Validate `X-Twilio-Signature` |
| `logger.js` | Structured logging + optional alerts |
| `encryption.js` | Optional AES helpers |
| `timezone.js` | Timezone helpers for logs/cron |

### 6.3 `api/tests/`

| File | Role |
|------|------|
| `passwordPolicy.test.js` | Password rules vs Supabase |
| `security.test.js` | sanitize, rbac, cors |
| `twilioSignature.test.js` | Webhook HMAC |

Run: `npm run test:unit`

### 6.4 Main API route groups (`api/index.js`)

**Health / debug**

- `GET /health`
- `GET /api/debug/session`, `GET /webhook/debug` (ops; restrict in prod if exposed)

**Auth**

- `POST /api/auth/login`
- `POST /api/auth/register` — password policy enforced
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/change-password` — requires current password
- `POST /api/auth/link-whatsapp`

**Projects & settings**

- `GET/POST /api/projects`
- `GET/PATCH /api/projects/:projectId/settings`
- `GET /api/projects/:projectId/summary`

**Expenses / issues / tasks / daily / materials / trends**

- Expenses: list, create, patch, delete  
- Issues: list, create, patch  
- Tasks: `GET/POST /api/projects/:id/tasks`, `PATCH .../tasks/:taskId`  
- Daily logs & photos  
- Materials + material daily transactions  
- Trends endpoints  

**Dashboard aggregates**

- `/api/dashboard/summary|progress|budget|inventory|issues|media|trends`

**Other**

- `POST /api/waitlist`
- Images list, assorted `/api/test/*` (dev aids)

---

## 7. `client/` — frontend

### 7.1 Bootstrap

| File | Role |
|------|------|
| `client/index.html` | HTML shell |
| `client/src/main.tsx` | React mount |
| `client/src/App.tsx` | Routes, providers, auth gates |
| `client/src/index.css` | Global CSS + design tokens |
| `client/src/types/index.ts` | Shared TS types |

### 7.2 Routes (`App.tsx`)

| Path | Page | Auth |
|------|------|------|
| `/` | Landing or redirect → `/projects` | Public / authed |
| `/login`, `/signup` | Auth | Public |
| `/forgot-password`, `/reset-password`, `/auth/callback` | Password recovery | Public |
| `/projects` | Project list | Required |
| `/dashboard?project=` | Full project dashboard | Required |
| `/budget`, `/materials`, `/daily`, `/trends` | Feature pages | Required |
| `/settings`, `/help` | Settings / help | Required |
| `/demo`, `/privacy`, `/terms` | Marketing / legal | Public |
| `/error`, `/maintenance` | Status pages | Public |
| `*` | 404 | — |

### 7.3 `client/src/pages/`

| File | Purpose |
|------|---------|
| `landing.tsx` | Marketing landing (composes landing sections) |
| `login.tsx` / `signup.tsx` | Auth forms; signup uses password checklist |
| `forgot-password.tsx` / `reset-password.tsx` | Reset flow (30-min link copy) |
| `ProjectsPage.tsx` | List / create projects |
| `DashboardPage.tsx` | Thin wrapper / alternate entry |
| `BudgetPage.tsx` | Budgets & expenses UI |
| `MaterialsPage.tsx` | Inventory |
| `DailyPage.tsx` | Daily logs |
| `TrendsPage.tsx` | Trends / charts |
| `SettingsPage.tsx` | Profile, WhatsApp link, **change password** |
| `HelpPage.tsx` | In-app help / WhatsApp commands |
| `home.tsx`, `demo.tsx`, `EmptyState.tsx` | Misc |
| `privacy.tsx`, `terms.tsx` | Legal |
| `error.tsx`, `maintenance.tsx`, `not-found.tsx` | Error UX |

### 7.4 `client/src/contexts/`

| File | Purpose |
|------|---------|
| `AuthContext.tsx` | Login/register/session (via hooks) |
| `ThemeContext.tsx` | Dark/light (`jenga_theme`) |
| `LanguageContext.tsx` | i18n: EN / LG / PT strings |
| `ProjectContext.tsx` | Current project selection |

### 7.5 `client/src/hooks/`

| File | Purpose |
|------|---------|
| `useAuth.ts` | Auth API surface |
| `useProjects.ts` | Projects query + invalidation |
| `useDashboard.ts` | Dashboard data fetching |
| `useProjectLiveRefresh.ts` | Auto-refresh without full reload |
| `usePageTitle.ts`, `use-mobile.tsx`, `use-toast.ts`, `useHaptic.ts`, `useChartHeight.ts` | UX helpers |

### 7.6 `client/src/lib/`

| File | Purpose |
|------|---------|
| `queryClient.ts` | TanStack Query + `apiRequest` |
| `authToken.ts` | JWT storage helpers |
| `authUtils.ts` | Auth helpers |
| `analytics.ts` | Expense/analytics helpers |
| `budgetUtils.ts` | Budget calculations (UI) |
| `excelParser.ts` | Excel/CSV import |
| `uploadPhoto.ts` | Photo upload |
| `websocket.ts` | WS helper (if used) |
| `navTokens.ts` | Nav design tokens |
| `utils.ts` | `cn()` etc. |

### 7.7 `client/src/components/` (by subfolder)

| Folder | Purpose |
|--------|---------|
| `layout/` | `AppLayout`, `Sidebar`, `TopBar`, `BottomNav`, `MoreBottomSheet`, headers |
| `landing/` | Landing sections + `Navigation.tsx` (mobile hamburger fixed for dark contrast) |
| `dashboard-new/` | Main dashboard composition (`DashboardPage.tsx` + section components) |
| `projects/` | `ProjectCard`, `NewProjectModal` |
| `charts/` | Spend / category charts |
| `auth/` | `PasswordRequirements.tsx` checklist |
| `animations/` | Page transitions, animated numbers |
| `ui/` | shadcn primitives + brand widgets (`KPICard`, `Logo`, `LanguageSwitcher`, …) |
| `_archive_legacy/` | Old screens — **do not use for new work** |
| Root `components/*.tsx` | Dialogs (expense, project, export, excel), `TaskManagement`, `ErrorBoundary`, etc. |

### 7.8 Static assets

- `client/public/assets/images/` — logo, hero mockups  
- `client/public/images/` — hero / stock  
- Prefer `client/public` for Vite-served assets  

---

## 8. `shared/` — shared modules

| File | Purpose |
|------|---------|
| `schema.ts` | Drizzle table definitions (source of truth for TS ↔ DB) |
| `calculations.js` + `.d.ts` | Budget %, burn, inventory math (client + server + WhatsApp) |
| `formatting.js` + `.d.ts` | Currency / display formatting |
| `materialNames.ts` | Normalize material names across API + webhook |
| `passwordPolicy.js` + `.d.ts` | Supabase-aligned password rules (8+, upper, lower, digit, symbol) |
| `supabaseEmailAuth.js` | OTP length 8, expiry 1800s constants |

**Password policy (must match Supabase Auth → Email):**

- Min length **8**  
- Lowercase + uppercase + digit + symbol  
- Enforced on signup, reset, change-password (client + API)

---

## 9. Database — tables & migrations

### 9.1 Core tables (from `shared/schema.ts`)

| Table | Purpose |
|-------|---------|
| `profiles` | User profile; WhatsApp number; onboarding / expense conversation state |
| `projects` | Projects (budget, spent, currency, status, channel_type) |
| `expense_categories` | Global categories |
| `expenses` | Spend lines (whatsapp / dashboard / api) |
| `tasks` | Checklist items |
| `images` | Media metadata |
| `whatsapp_messages` | Inbound/outbound audit; `message_sid` unique for idempotency |
| `materials_inventory` | Stock per project |
| `material_transactions` | Purchase / usage / adjustment history |
| `vendors` | Vendor spend rollups |
| `daily_logs` | Workers, notes, milestones, photos, activity_entries |
| `issues` | Site issues / risks |
| `sessions` | Optional express-session store |
| `ai_usage_log` | AI cost tracking (if present) |

Profiles can be linked via `auth_user_id` so WhatsApp-only profiles merge with dashboard Auth users.

### 9.2 `migrations/` (run in Supabase SQL editor as needed)

**Baseline / dangerous**

- `create-schema.sql` — create  
- `drop-everything.sql` — **destructive**; never on prod casually  

**Feature migrations (historical)**

- Tasks, issues, materials, vendors, daily logs, onboarding fields  
- Expense state / disputed / vendor category  
- WhatsApp message SID uniqueness, AI columns  
- Profile `active_project`, `auth_user_id`  
- Password hash add/remove (legacy; Auth is Supabase now)  
- Triggers: `auto_update_project_spent.sql`, `sync_project_spent_from_expenses.sql`  

**RLS / security (apply if not yet on prod)**

1. `security_rls_projects_expenses.sql`  
2. `security_performance_indexes.sql`  
3. Also: `profiles_rls_policies.sql`, `rls_materials_inventory.sql`, `rls_daily_logs_issues_vendors_sessions.sql`  

API often uses **service role** (bypasses RLS). RLS still matters for any anon/authenticated client access and defense in depth.

---

## 10. `scripts/` — operations

| Script | Use |
|--------|-----|
| `seed.ts` | Seed data |
| `create-supabase-user.ts` / `create-test-user.ts` | Create users |
| `add-user-password.ts` / `add-password-to-any-user.ts` | Legacy password helpers |
| `backfill-materials-from-expenses.ts` | Backfill inventory from expenses |
| `backup-supabase.sh` | CLI backup (link Supabase CLI first) |
| `run-migration.ts` | Run a migration file |
| `test-env.ts` / `test-health.ts` | Env & health checks |
| `*.sql` | One-off admin / diagnose / fix scripts |

---

## 11. `server/` — legacy local server

Used by `npm run dev` (`tsx watch server/index.ts`). Contains:

| Area | Files |
|------|-------|
| Entry | `index.ts`, `vite.ts`, `static.ts` |
| Routes | `routes.ts`, `routes/api.ts`, `routes/whatsapp.ts` |
| WhatsApp (older) | `whatsappHandler.ts`, `twilioWebhookHandler.ts`, `webhookHandler.ts`, `twilio.ts` |
| AI | `aiService.ts`, `services/aiUpdateParser.ts`, `services/intentParser.ts`, `services/onboardingService.ts` |
| Auth | `simpleAuth.ts`, `replitAuth.ts` |
| Data | `db.ts`, `storage.ts`, `lib/supabase.ts` |
| Other | `exportService.ts`, `extractedDataHandler.ts`, `errorHandler.ts` |
| Tests | `tests/whatsapp.test.ts` |
| Seed | `scripts/seedTestUser.ts` |

**Handoff rule:** Prefer fixing **production** behavior in `api/` + `client/`. Only change `server/` if you still develop against the local Express path and keep both in sync deliberately.

---

## 12. Docs & CI

| Path | Status |
|------|--------|
| `docs/SECURITY_SETUP.md` | Password reset, Twilio signature, CORS, RLS, backups, rollbacks |
| `TROUBLESHOOTING_GUIDE.md` | Bot / Vercel / dashboard issues |
| `.github/workflows/ci.yml` | Unit tests on PR (may be **unpushed** — PAT needed `workflow` scope) |
| `.github/dependabot.yml` | Dependency PRs (same note) |

---

## 13. Design system (quick)

- **Primary:** Fresh Fern `#93C54E`  
- **Secondary:** Ocean Pine `#218598`  
- **Dark-first** dashboard; fonts: League Spartan + Nunito Sans + JetBrains Mono  
- Tokens in `tailwind.config.ts` + `client/src/index.css` (`--jt-*`, shadcn HSL vars)

---

## 14. Auth & security (current contract)

1. **Register / login** via Supabase Auth through API routes; API issues **JWT** for subsequent calls.  
2. **Password rules** = Supabase Email provider: 8+ chars, lower, upper, digit, symbol (`shared/passwordPolicy.js`).  
3. **Reset links** expire in **30 minutes** (1800s); enforced in UI copy + `api/utils/authz.js`.  
4. **Change password** requires current password (Settings + API verify via `signInWithPassword`).  
5. **Secure email change** is on in Supabase; app does **not** expose email edit in Settings (avoids bypassing dual confirm).  
6. **Twilio webhook** verifies signature when `WEBHOOK_PUBLIC_URL` + auth token are set.  

---

## 15. WhatsApp product behavior (summary)

Users text the Twilio WhatsApp number. Handler:

1. Validates Twilio signature  
2. Resolves `profiles` by phone (or onboarding / register prompt)  
3. Parses intent (rules + AI) for expenses, materials, labor, issues, tasks, photos, voice  
4. Writes to Supabase; replies via Twilio  
5. Logs to `whatsapp_messages` with unique `message_sid`  

Dashboard shows the same projects after WhatsApp number is linked (`/api/auth/link-whatsapp` or matching profile).

---

## 16. Local development

```bash
git clone https://github.com/gabbyshey334-ux/BuildMonitor.git
cd BuildMonitor
npm install
cp .env.example .env   # fill secrets
npm run dev            # Vite + server/ (local)
# OR for production-parity API, deploy to Vercel preview

npm run build          # client + compile api/_*.ts → api/*.js
npm run test:unit
npm run test:env && npm run test:health
```

After changing `_whatsapp-webhook.ts` or `_daily-heartbeat.ts`, run `npm run build` and **commit the generated `.js` files**.

---

## 17. Deploy checklist (Vercel)

1. Connect GitHub `BuildMonitor` → `main`  
2. Set all env vars (section 5)  
3. Build: `npm run build` (see `vercel.json`)  
4. Output: `dist/public`  
5. Confirm rewrites: `/api/whatsapp-webhook`, `/api/*` → `index`, SPA fallback  
6. Cron: `0 17 * * *` → `/api/daily-heartbeat`  
7. Twilio webhook = `WEBHOOK_PUBLIC_URL`  
8. Supabase Auth URL allowlist includes `/reset-password` and site URL  

---

## 18. Open / leftover work

| Item | Owner | Notes |
|------|--------|------|
| **Twilio console webhook** | Needs Twilio access | Set POST → `https://jengatrack.com/api/whatsapp-webhook`; match `WEBHOOK_PUBLIC_URL` |
| **Push `.github/` workflows** | Dev with PAT `workflow` scope | Currently untracked/unpushed on last push |
| **Run security SQL on prod** | Supabase admin | `security_rls_*.sql` + `security_performance_indexes.sql` if not applied |
| Confirm migrations applied | Supabase | Audit with `scripts/supabase-migrations-audit.sql` |
| Optional PITR / backups | Ops | `scripts/backup-supabase.sh` |

---

## 19. What shipped recently (handoff context)

From recent work on `main`:

- Mobile landing **hamburger menu** contrast / dark panel fix  
- **Password policy** aligned with Supabase Email settings + checklist UI  
- API security utilities (CORS, rate limit, sanitize, RBAC, Twilio signature, authz)  
- Security migrations + `docs/SECURITY_SETUP.md`  
- Unit tests under `api/tests/`  
- Error / maintenance pages  
- Prior features: web task creation, WhatsApp materials/expenses, dashboard live refresh  

---

## 20. Contacts & accounts to transfer

Handoff recipients need access to:

1. **GitHub** — `gabbyshey334-ux/BuildMonitor`  
2. **Vercel** — project + env vars + domains (`jengatrack.com`)  
3. **Supabase** — project `ouotjfddslyrraxsimug` (from Auth dashboard URL) — SQL, Auth, Storage  
4. **Twilio** — WhatsApp sender + webhook (blocker until access granted)  
5. **AI keys** — OpenAI and/or Gemini  
6. Domain DNS for `jengatrack.com`  

---

## 21. File-count orientation

Roughly **~300+** application source files (excluding `node_modules` / `.git`). Largest critical files:

- `api/_whatsapp-webhook.ts` / `whatsapp-webhook.js` — bot brain  
- `api/index.js` — HTTP API  
- `shared/schema.ts` — data model  
- `client/src/components/dashboard-new/DashboardPage.tsx` — main dashboard UI  
- `client/src/contexts/LanguageContext.tsx` — all UI copy (EN/LG/PT)  

---

## 22. Golden rules for the next engineer

1. **Production = `api/` + `client/` + Supabase + Twilio.** Treat `server/` as legacy unless you own both.  
2. Edit `api/_whatsapp-webhook.ts`, then rebuild and commit `api/whatsapp-webhook.js`.  
3. Keep password / email auth settings in sync with Supabase Dashboard and `shared/passwordPolicy.js` / `shared/supabaseEmailAuth.js`.  
4. Never commit `.env`. Use `.env.example` as the checklist.  
5. Twilio URL and `WEBHOOK_PUBLIC_URL` must be identical.  
6. Prefer `shared/calculations.js` and `shared/materialNames.ts` over duplicating formulas.  
7. Soft-deletes (`deleted_at`) are used widely — filter them in queries.  

---

*End of handoff. For day-to-day incidents, start with `TROUBLESHOOTING_GUIDE.md` and `docs/SECURITY_SETUP.md`.*
