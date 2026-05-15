# Security setup guide

Operational steps for JengaTrack production hardening.

## Password reset (30 minutes)

### Supabase Dashboard

1. Open **Authentication** → **Providers** → **Email**.
2. Set **Email OTP expiry** (or recovery link expiry) to **1800** seconds (30 minutes).
3. Under **URL configuration**, add your site URL and redirect allow list:
   - `https://your-domain.com/reset-password`
   - `https://your-domain.com/auth/callback`
4. Confirm **Reset Password** email template is enabled under **Email Templates**.

### Application

- The API enforces a **30-minute** max age on recovery tokens (`api/utils/authz.js`).
- UI copy on forgot/reset pages matches this limit.
- Minimum password length: **8 characters** on reset.

## Twilio WhatsApp webhook signature

Twilio signs every webhook with `X-Twilio-Signature`. The handler validates it before processing messages.

### Vercel environment variables

```bash
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+...
WEBHOOK_PUBLIC_URL=https://your-domain.vercel.app/api/whatsapp-webhook
```

`WEBHOOK_PUBLIC_URL` must match **exactly** what is configured in the Twilio console (scheme, host, path — no trailing slash). Vercel rewrites can add query params that break signature checks if you reconstruct the URL from `req.url`.

### Twilio console

1. **Messaging** → your WhatsApp sender → **Webhook URL for incoming messages**:
   `https://your-domain.vercel.app/api/whatsapp-webhook`
2. Method: **POST**.

### Local development only

```bash
SKIP_TWILIO_SIGNATURE=1
```

Never set this in production. The server rejects bypass in `VERCEL_ENV=production`.

## CORS and API access

```bash
ALLOWED_ORIGINS=https://jengatrack.com,https://your-app.vercel.app
DASHBOARD_URL=https://jengatrack.com
```

## Database RLS and indexes

Run in Supabase SQL editor (in order):

1. `migrations/security_rls_projects_expenses.sql`
2. `migrations/security_performance_indexes.sql`

## Backups

- Enable Supabase **Point-in-Time Recovery** on a paid plan.
- Schedule `scripts/backup-supabase.sh` (requires Supabase CLI linked to the project).

## Rollbacks (Vercel)

1. **Deployments** → select the last good deployment → **Promote to Production**.
2. CI runs tests on every PR; merge only when green.

## Alerts

Optional Slack/Discord webhook for API 5xx errors:

```bash
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
```
