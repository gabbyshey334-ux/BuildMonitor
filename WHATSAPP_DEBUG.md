# WhatsApp Integration Debug Guide

## Issue: No Reply Messages Received

If you send a message to the Twilio WhatsApp number but don't receive a reply, follow these steps:

## Step 1: Verify Webhook is Configured in Twilio

1. Go to: https://console.twilio.com/
2. Navigate to: **Messaging** → **Settings** → **WhatsApp Sandbox** (or **WhatsApp Senders**)
3. Check the **Webhook URL** is set to:
   ```
   https://build-monitor-lac.vercel.app/webhook/webhook
   ```
4. **Method**: POST
5. **Save** if you made changes

## Step 2: Check Vercel Logs

1. Go to: https://vercel.com/dashboard
2. Select project: `build-monitor-lac`
3. Click **"Logs"** tab
4. Filter by: **Runtime logs**
5. Look for: `[WhatsApp Webhook]` messages

### What to Look For:

**✅ Good Signs:**
- `[WhatsApp Webhook] req_xxx - Received request`
- `[WhatsApp Webhook] req_xxx - ✅ Validation passed`
- `[Twilio Send] ✅ Message sent successfully`

**❌ Bad Signs:**
- `[WhatsApp Webhook] Error:` (webhook not processing)
- `[Twilio Send] ❌ Failed to send WhatsApp message`
- No logs at all (webhook not being called)

## Step 3: Verify Environment Variables

In Vercel Dashboard → Settings → Environment Variables, ensure:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

## Step 4: Test Webhook Endpoint

After deployment, test if webhook is accessible:

```bash
curl -X POST https://build-monitor-lac.vercel.app/webhook/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+256700000001&Body=test&MessageSid=test123"
```

Should return: `<Response></Response>`

## Step 5: Check Twilio Console

1. Go to: https://console.twilio.com/
2. Navigate to: **Monitor** → **Logs** → **Messaging**
3. Look for your message:
   - **Status**: Should be "delivered" or "sent"
   - **Error Code**: If present, check what it means
   - **Webhook Status**: Should show if webhook was called

## Common Issues

### Issue 1: Webhook Not Being Called

**Symptoms:**
- No logs in Vercel
- Message shows as "delivered" in Twilio but no reply

**Solutions:**
1. Verify webhook URL in Twilio console
2. Check webhook URL is accessible (test with curl)
3. Ensure webhook URL uses HTTPS (required by Twilio)

### Issue 2: Webhook Called But No Reply Sent

**Symptoms:**
- Logs show `[WhatsApp Webhook] Received request`
- But no `[Twilio Send] ✅ Message sent`

**Solutions:**
1. Check Vercel logs for errors
2. Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are set
3. Check if user profile exists (unregistered users get welcome message)

### Issue 3: Twilio Authentication Error

**Symptoms:**
- `[Twilio Send] ❌ Failed to send WhatsApp message`
- Error: "Authentication failed" or "Invalid credentials"

**Solutions:**
1. Verify `TWILIO_ACCOUNT_SID` is correct
2. Verify `TWILIO_AUTH_TOKEN` is correct (not expired)
3. Regenerate auth token if needed

### Issue 4: User Not Found

**Symptoms:**
- Logs show: `User not found: +256XXXXXXXXX`
- Welcome message should be sent

**Solutions:**
1. Register the WhatsApp number in the dashboard
2. Or ensure welcome message is being sent (check logs)

## Debug Endpoints

After deployment, you can test:

1. **Webhook Test**: 
   ```
   POST /webhook/webhook
   Body: From=whatsapp:+256700000001&Body=test
   ```

2. **Check if webhook route exists**:
   ```
   GET /webhook/webhook
   Should return 404 (POST only)
   ```

## Expected Flow

1. **User sends message** → Twilio receives
2. **Twilio calls webhook** → `POST /webhook/webhook`
3. **Webhook processes** → Logs show `[WhatsApp Webhook] Received request`
4. **Intent parsed** → Logs show intent type
5. **Reply generated** → Handler creates reply message
6. **Reply sent** → `sendWhatsAppMessage()` called
7. **User receives reply** → Message appears in WhatsApp

## After Fix Deployment

1. **Deploy to Vercel** (all fixes are committed)
2. **Check Vercel logs** immediately after sending a test message
3. **Look for**:
   - `[WhatsApp Webhook]` logs showing request received
   - `[Twilio Send]` logs showing message sent
   - Any error messages

## Next Steps

If still not working after deployment:
1. Share Vercel logs showing the webhook processing
2. Share Twilio console logs showing message status
3. Verify webhook URL is correctly configured in Twilio

---

**All fixes are committed and ready to deploy!** 🚀

