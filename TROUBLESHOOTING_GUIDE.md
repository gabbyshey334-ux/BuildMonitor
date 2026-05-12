# Troubleshooting guide

Covers the **WhatsApp (Twilio) bot**, **Vercel deployment**, and the **dashboard** (web app + Supabase).

---

## Standard troubleshooting steps

Use this order for any incident before deep-diving into one subsystem:

1. **Confirm scope:** one user vs all users, sandbox vs production, dashboard only vs webhook only.
2. **Check recent changes:** latest deploy, changed env vars, Supabase changes, Twilio console changes.
3. **Reproduce once with fresh data:** send one controlled test message and capture timestamp + `MessageSid`.
4. **Trace end-to-end logs:** Twilio delivery logs -> Vercel function logs -> database writes -> outbound reply.
5. **Classify failure point:** inbound webhook, AI generation, outbound send, auth/data layer, or frontend rendering.
6. **Apply smallest safe fix:** env correction, route fix, timeout/fallback tweak, or rollback to last known good deploy.
7. **Verify and monitor:** re-test with at least 2 messages and watch logs for 10-15 minutes.

---

## Vercel build & deploy

### Error: `The pattern "api/whatsapp-webhook.js" defined in functions doesn't match any Serverless Functions`

**Cause:** `vercel.json` lists `functions["api/whatsapp-webhook.js"]`, but that file was not in the Git repo (for example it was gitignored).

**Fix:**

1. Ensure `api/whatsapp-webhook.js` and `api/daily-heartbeat.js` are **tracked in Git** (not ignored).
2. Run `node build-api.js` locally and commit the generated `api/*.js` files.
3. Redeploy. The production build still runs `npm run build`, which rebuilds those files; the committed copies exist so Vercel’s config validation passes.

### Build fails on `npm run build`

- Run `npm install` fresh.
- Check Node version (18+).
- Read the first real error in the build log (TypeScript, Vite, or esbuild for `build-api.js`).

### `maxDuration` / timeouts on webhooks

- `vercel.json` sets a longer limit for `api/whatsapp-webhook.js`. If you rename files or change paths, update `vercel.json` to match the actual `api/*.js` entry.
- Heavy AI or Twilio calls can still hit platform limits; see WhatsApp section below.

---

## WhatsApp (no reply, delayed reply, or errors)

### 1. Twilio webhook URL

- In Twilio Console → your WhatsApp sender / sandbox, set the **webhook** (POST) to your live URL, e.g. `https://<project>.vercel.app/api/whatsapp-webhook`.
- Method must be **POST**. Save and wait for Twilio to apply.

### 2. Environment variables (Vercel)

Confirm these are set for **Production** (and Preview if you test there):

| Variable | Role |
|----------|------|
| `TWILIO_ACCOUNT_SID` | Account identifier |
| `TWILIO_AUTH_TOKEN` | API auth |
| `TWILIO_WHATSAPP_NUMBER` | `whatsapp:+...` sender |
| `SUPABASE_URL` | Database |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side access (webhook) |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | AI replies (at least one recommended) |
| `DASHBOARD_URL` | Links in messages (optional but recommended) |

Redeploy after changing env vars.

### 3. Sandbox vs production

- **Sandbox** only messages numbers you have joined to the sandbox.
- **Production** numbers require approved WhatsApp Business / Twilio setup.

### 4. Duplicate or retried messages (MessageSid)

Twilio may retry the same `MessageSid`. The app is designed to **still process** the message so a reply can be sent on retry. If you see odd duplicates, check Vercel logs for that request.

### 5. “Logs stop after `[Agent] Processing message`”

Typical chain: load context → call Gemini/OpenAI → send via Twilio REST or TwiML fallback.

- If **AI keys** are missing or invalid, fallbacks should still return text; check logs for model errors.
- If **Twilio REST** is slow or failing, the handler may fall back to **TwiML** in the HTTP response; check logs for `STEP9` and Twilio errors.
- **HTTP timeouts** are mitigated in code with deadlines; if the whole function exceeds Vercel’s max duration, increase the limit in `vercel.json` (where supported by your plan) and keep the webhook function path correct.

### 6. Empty TwiML / 200 with no message

- Ensure the handler does not call `res.send` twice and that errors return valid TwiML when needed.
- Check for middleware or rewrites sending `/api/whatsapp-webhook` to the wrong function (see `vercel.json` rewrites).

---

## Dashboard (login, data, “can’t connect”)

### 1. Supabase auth & API URL

- Dashboard expects Supabase (and any JWT/session config) to match the **same project** as the service role used by the API.
- If login fails: verify Supabase **Auth** settings, redirect URLs, and that email/provider settings match your deployment URL.

### 2. `SUPABASE_URL` and keys

- **Anon** key: safe for browser (with RLS).
- **Service role**: server only; never expose in client bundles. The WhatsApp webhook uses the service role on the server.

### 3. CORS / API base URL

- The browser must call APIs on the same deployment (or an explicitly allowed origin). Wrong `VITE_*` or API base URL → network errors in the devtools **Network** tab.

### 4. Data missing on dashboard but WhatsApp works

- Confirm you are logged in as a user linked to the same `profiles` / project rows the bot uses (same Supabase project and user mapping).

### 5. 500 / blank page after deploy

- Open the browser console and Network tab; check the failing request path.
- On Vercel, check **Functions** logs for the matching `/api/...` route.
- Verify env vars exist on **Production** (Vercel often has separate Preview/Production envs).

---

## Quick log checklist (Vercel)

When debugging a single WhatsApp message:

1. `POST /api/whatsapp-webhook` received.
2. User/project resolution logs (`userId`, `projectId`).
3. `[Agent] Loading DB context` → `DB context loaded` → `Context ready — calling LLM` (or errors in between).
4. `[Webhook] STEP9: reply ready` and either Twilio success or TwiML fallback / error lines.

If step 1 is missing, Twilio is not hitting your deployment URL. If steps 1–2 work but there is no reply, focus on AI env vars, Twilio send errors, and function duration.

---

## How to retrain or update responses

For this bot, "retraining" usually means updating prompt/context logic and validating behavior, rather than model fine-tuning.

### Update response behavior safely

1. Modify system instructions/prompt templates and response formatting rules in source control.
2. Update retrieval/context assembly logic (DB context, profile/project data, memory windows) if response quality issues are context-related.
3. Add or refresh regression examples (input -> expected reply) for critical intents.
4. Test in Preview with representative conversations (normal, edge, and failure flows).
5. Promote to Production only after no regressions in tone, safety, and response latency.

### Optional model/provider updates

- If switching providers/models (Gemini/OpenAI), update env vars and any model-specific parameters together.
- Roll out gradually (Preview first), then watch error/latency trends before full traffic reliance.

---

## How to monitor issues early

Use proactive alerts so failures are caught before users report them:

- **Heartbeat monitor:** keep `api/daily-heartbeat.js` active and alert if it stops running.
- **Webhook health checks:** alert on spikes in 4xx/5xx and on sharp drops in inbound webhook volume.
- **Latency guardrails:** alert when p95 webhook duration approaches Vercel timeout limits.
- **Provider errors:** track AI provider errors and Twilio send failures separately to isolate blast radius quickly.
- **Data integrity checks:** schedule periodic checks for missing expected rows (messages, profile links, or project associations).
- **Log review cadence:** quick daily scan of function logs, with deeper weekly trend review.

---

## Fallback handling recommendations

Design fallbacks so users still get a useful response during partial outages:

1. **AI fallback chain:** primary model -> secondary model -> deterministic safe text reply.
2. **Transport fallback:** Twilio REST send attempt -> TwiML response fallback when REST fails/timeouts.
3. **Timeout budgets:** enforce internal step deadlines so one slow dependency does not consume total function runtime.
4. **Graceful degradation:** if context load fails, reply with a reduced-capability message rather than silence.
5. **Idempotency-first retries:** accept retried `MessageSid` safely to avoid dropping messages.
6. **Operator visibility:** log fallback path taken (`primary_failed`, `fallback_model_used`, `twiml_fallback`) for each request.

---

## Maintenance best practices

- Keep `api/*.js` generated files and `vercel.json` function paths synchronized after any file move/rename.
- Rotate and validate secrets regularly (Twilio, Supabase, AI keys), and redeploy after updates.
- Review Supabase schema/RLS changes with webhook and dashboard flows together to avoid permission drift.
- Maintain a small smoke-test checklist for every deploy (inbound message, AI response, DB write, dashboard read).
- Track dependency updates monthly and patch known security or reliability issues early.
- Keep runbooks current: when an incident happens, add root cause + fix notes to this guide.

---

## Need to reset local dependencies

If many files under `node_modules` were removed accidentally (e.g. cleanup of `*.md` that included dependencies), run:

```bash
rm -rf node_modules
npm install
```

This does not affect application source code.
