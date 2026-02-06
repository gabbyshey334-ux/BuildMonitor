# WhatsApp Integration Setup Guide

## Overview

JengaTrack uses Twilio's WhatsApp Business API to allow users to log expenses, create tasks, and check budgets via WhatsApp messages.

## Prerequisites

- Twilio account with WhatsApp sandbox enabled
- Vercel deployment of the backend
- User registered in the system with their WhatsApp number

## Backend Implementation

The WhatsApp webhook is already implemented at:
- **Route**: `POST /webhook/webhook`
- **Handler**: `api/index.js` (webhookHandler function)
- **Features**:
  - User lookup by WhatsApp number
  - Intent parsing (rule-based + AI fallback)
  - Expense logging
  - Task creation
  - Budget queries
  - Help messages

## Step 1: Configure Twilio Webhook

### 1.1 Access Twilio Console

Go to: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox

### 1.2 Set Webhook URL

Under "Sandbox Configuration", find **"WHEN A MESSAGE COMES IN"**:

**URL:**
```
https://build-monitor-lac.vercel.app/webhook/webhook
```

**HTTP Method:** `POST`

**Important:** The endpoint is `/webhook/webhook` (not `/webhook/whatsapp`)

Click **Save** to apply changes.

### 1.3 Optional: Status Callback

Under **"STATUS CALLBACK URL"** (optional):
```
https://build-monitor-lac.vercel.app/webhook/status
```

## Step 2: Join WhatsApp Sandbox

### 2.1 Get Your Sandbox Code

1. Go to: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. Find the "Your Sandbox" section
3. Note the join code (e.g., "join hello-world")

### 2.2 Connect Your Phone

1. Open WhatsApp on your phone
2. Add Twilio's WhatsApp number as a contact: `+1 (415) 523-8886` (or your region's number)
3. Send the join message: `join [your-sandbox-code]`
4. Wait for confirmation: "You are all set!"

## Step 3: Register User with WhatsApp Number

### 3.1 User Registration Format

Users must register on the platform with their WhatsApp number in **E.164 format**:

**Correct format:**
```
+256700000001
```

**Incorrect formats:**
```
0700000001        ❌ Missing country code
256700000001      ❌ Missing + prefix
+256 700 000 001  ❌ Contains spaces
```

### 3.2 Verify User Registration

Run this SQL query in Supabase to verify:

```sql
SELECT id, full_name, email, whatsapp_number 
FROM users 
WHERE whatsapp_number = '+256700000001'; -- Replace with actual number
```

### 3.3 Fix Incorrect Format

If the WhatsApp number format is wrong:

```sql
UPDATE users 
SET whatsapp_number = '+256700000001' -- Correct E.164 format
WHERE email = 'user@example.com';
```

## Step 4: Environment Variables

Ensure these environment variables are set in Vercel:

```bash
# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Session
SESSION_SECRET=your-random-secret-string

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=+14155238886

# Optional
DASHBOARD_URL=https://build-monitor-lac.vercel.app
OPENAI_API_KEY=sk-... (for AI-powered intent parsing)
```

**To set in Vercel:**
1. Go to: https://vercel.com/dashboard → build-monitor-lac → Settings → Environment Variables
2. Add/update each variable
3. Redeploy after changes

## Step 5: Test the Integration

### 5.1 Test Webhook Endpoint

```bash
curl -X POST https://build-monitor-lac.vercel.app/webhook/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+256700000001" \
  -d "Body=test message" \
  -d "MessageSid=SM123"
```

**Expected:** XML response (TwiML format)

### 5.2 Test End-to-End Flow

**Send via WhatsApp:**
```
Hello
```

**Expected Reply (if user not registered):**
```
👋 Welcome to JengaTrack!

Please register at https://build-monitor-lac.vercel.app to get started.

Once registered, you can track expenses, manage tasks, and monitor your construction projects via WhatsApp.
```

**Expected Reply (if user registered):**
```
Hi [Your Name]! 👋

I received your message: "Hello"

Try these commands:
• "spent 50000 on cement" - Log an expense
• "task: inspect foundation" - Create a task
• "budget?" - Check your budget
```

### 5.3 Test Expense Logging

**Send:**
```
spent 50000 on cement
```

**Expected Reply:**
```
✅ Expense Logged

Amount: 50,000 UGX
Description: cement
Category: Materials

Project: [Your Project Name]
View details: https://build-monitor-lac.vercel.app/dashboard
```

### 5.4 Test Task Creation

**Send:**
```
task: inspect foundation tomorrow
```

**Expected Reply:**
```
✅ Task Created

Title: inspect foundation tomorrow
Status: To Do

Project: [Your Project Name]
View tasks: https://build-monitor-lac.vercel.app/dashboard
```

## Step 6: Monitor and Debug

### 6.1 Check Vercel Logs

Go to: https://vercel.com/dashboard → build-monitor-lac → Logs

**Filter for:** `/webhook/webhook`

**Look for:**
```
[WhatsApp Webhook] req_... - Received request
[WhatsApp Webhook] req_... - User found: John Doe (uuid)
[WhatsApp Webhook] req_... - Intent parsed: log_expense
[WhatsApp Webhook] req_... - ✅ Expense logged: 123
```

### 6.2 Check Supabase Logs

Go to: Supabase Dashboard → Logs & Reports

**Check:**
- Messages being inserted into `whatsapp_messages` table
- Expenses being created
- Tasks being created

### 6.3 Debug Endpoint

Access the debug endpoint to view recent WhatsApp messages:

```
GET https://build-monitor-lac.vercel.app/webhook/debug?limit=50
```

This returns:
- Recent WhatsApp messages from the database
- Message processing status
- User associations
- Intent parsing results

### 6.4 Common Issues

#### Issue: No response from bot

**Cause:** Webhook URL not configured correctly

**Fix:** Verify Twilio webhook is set to `https://build-monitor-lac.vercel.app/webhook/webhook`

#### Issue: "Please register" even though registered

**Cause:** WhatsApp number format mismatch

**Fix:** 
```sql
-- Check format
SELECT whatsapp_number FROM users WHERE email = 'user@example.com';

-- Should be: +256700000001 (E.164 format)
```

#### Issue: Webhook receives message but no reply

**Cause:** Twilio credentials invalid or not set

**Fix:** Verify environment variables in Vercel (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

#### Issue: Error in logs

**Check:** Vercel logs for specific error message and stack trace

## Supported Commands

### Expense Logging

**English:**
- "spent 50000 on cement"
- "paid 30000 for labor"
- "bought materials 100000"

**Luganda:**
- "nimaze 50000 ku cement"
- "nsasuye 30000 ku labor"

### Task Management

- "task: inspect foundation"
- "todo: order materials"
- "reminder: pay workers tomorrow"

### Budget Queries

- "budget?"
- "how much spent?"
- "remaining budget"

### Help

- "help"
- "commands"
- "?"

## Security Notes

1. **Webhook Security:** Consider adding Twilio signature validation for production
2. **Rate Limiting:** Implement rate limiting to prevent abuse
3. **User Verification:** Verify WhatsApp number during registration
4. **Data Privacy:** WhatsApp messages are logged - ensure compliance with privacy laws

## Webhook Architecture

```
User WhatsApp Message
    ↓
Twilio WhatsApp API
    ↓
POST /webhook/webhook
    ↓
api/index.js (webhookHandler)
    ↓
1. Validate webhook data (Zod schema)
2. Extract phone number
3. Look up user in database
4. Parse intent (rule-based + AI)
5. Execute action (log expense, create task, etc.)
6. Send reply via Twilio
    ↓
User receives reply
```

## Message Flow

1. **User sends message** → Twilio receives it
2. **Twilio forwards** → POST to `/webhook/webhook`
3. **Webhook handler**:
   - Validates request (Zod schema)
   - Extracts phone number from `From` field
   - Looks up user by `whatsapp_number` in `users` table
   - If user not found → sends registration prompt
   - If user found → parses intent from message body
4. **Intent parsing**:
   - Rule-based patterns (e.g., "spent X on Y")
   - AI fallback (if OPENAI_API_KEY is set)
5. **Action execution**:
   - Log expense → Insert into `expenses` table
   - Create task → Insert into `tasks` table
   - Query budget → Calculate from `expenses` and `projects`
6. **Response**:
   - Format reply message
   - Send via Twilio API
   - Log message in `whatsapp_messages` table

## Database Schema

### whatsapp_messages Table

```sql
CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    phone_number TEXT NOT NULL,
    direction TEXT CHECK (direction IN ('inbound', 'outbound')),
    message_body TEXT,
    message_sid TEXT UNIQUE,
    intent TEXT,
    confidence NUMERIC,
    processed BOOLEAN DEFAULT false,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### User Lookup

The webhook looks up users by matching the `From` field (e.g., `whatsapp:+256700000001`) with the `whatsapp_number` column in the `users` table.

## Next Steps

1. ✅ Configure Twilio webhook URL
2. ✅ Join WhatsApp sandbox
3. ✅ Register with correct phone format
4. ✅ Test basic message
5. ✅ Test expense logging
6. ✅ Test task creation
7. ✅ Monitor logs for errors

## Support

For issues:
1. Check Vercel logs first
2. Verify Twilio configuration
3. Check user registration format
4. Test webhook endpoint directly
5. Review environment variables
6. Use debug endpoint: `/webhook/debug`

---

**Last Updated:** February 5, 2026  
**Webhook Endpoint:** `/webhook/webhook`  
**Twilio Sandbox Number:** +1 (415) 523-8886  
**Debug Endpoint:** `/webhook/debug`

