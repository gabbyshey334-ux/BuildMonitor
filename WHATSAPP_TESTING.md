# WhatsApp Integration Testing Guide

## Quick Test Commands

Test the WhatsApp integration with these example messages:

### ✅ Expense Logging (English)
```
spent 500 on cement
paid 200 for bricks
bought sand 150
500 for cement bags
cement 300
```

### ✅ Expense Logging (Luganda)
```
nimaze 300 ku sand
naguze cement 500
omaze 200
nasasudde 400 ku bricks
```

### ✅ Task Creation
```
task: inspect foundation
todo: buy materials
urgent: check workers
remind me to call supplier
need to visit site
```

### ✅ Budget Setting
```
set budget 1000000
my budget is 500000
budget yange 2000000
```

### ✅ Expense Queries
```
how much did I spend?
show expenses
total spent
what did I spend this week?
report
balance
```

### ✅ Image Upload
Send an image with one of these captions:
```
receipt for cement
paid 500 for bricks
materials purchase
```

### ✅ Unknown/Help
```
hello
help
what can you do?
```

## Expected Responses

### Expense Logged
```
✅ Expense recorded!

📝 cement
💰 UGX 500
📊 Project: House Construction

💵 Remaining budget: UGX 999,500
```

### Task Created
```
✅ Task created!

📋 inspect foundation
📊 Project: House Construction
⚡ Priority: medium

📝 You have 3 pending tasks.
```

### Budget Updated
```
✅ Budget updated!

📊 Project: House Construction
💰 New budget: UGX 1,000,000
💵 Already spent: UGX 500
💸 Remaining: UGX 999,500
```

### Expense Report
```
📊 *House Construction* Expense Report

💰 Budget: UGX 1,000,000
💵 Spent: UGX 5,500 (0.6%)
💸 Remaining: UGX 994,500
📝 Total expenses: 3

🔝 Top Categories:
1. Materials: UGX 3,000
2. Labor: UGX 2,000
3. Transport: UGX 500
```

### Help Message
```
🤖 I didn't quite understand that.

Here's what I can help with:

💰 *Log Expenses:*
"spent 500 on cement"
"paid 200 for bricks"

📋 *Create Tasks:*
"task: inspect foundation"
"todo: buy materials"

💵 *Set Budget:*
"set budget 1000000"

📊 *Check Expenses:*
"how much did I spend?"
"show expenses"

Need help? Visit https://buildmonitor.app
```

## Local Testing with ngrok

### 1. Install ngrok
```bash
npm install -g ngrok
```

### 2. Start your server
```bash
cd /Users/cipher/Downloads/BuildMonitor
npm run dev
```

### 3. In a new terminal, start ngrok
```bash
ngrok http 5000
```

You'll see output like:
```
Forwarding  https://xxxx-xx-xxx.ngrok.io -> http://localhost:5000
```

### 4. Update Twilio Webhook
1. Go to https://console.twilio.com/
2. Navigate to **Messaging** → **Try it out** → **Send a WhatsApp message**
3. Under **Sandbox Settings**, set webhook to:
   ```
   https://xxxx-xx-xxx.ngrok.io/api/whatsapp/webhook
   ```

### 5. Join Twilio Sandbox
1. Send the join code to your Twilio WhatsApp number
2. Example: "join <your-sandbox-name>"

### 6. Send Test Messages
Send any of the test commands above to your Twilio number.

## Testing Checklist

- [ ] **Expense Logging (English)**: "spent 500 on cement"
- [ ] **Expense Logging (Luganda)**: "nimaze 300 ku sand"
- [ ] **Task Creation**: "task: inspect foundation"
- [ ] **Budget Setting**: "set budget 1000000"
- [ ] **Expense Query**: "how much did I spend?"
- [ ] **Image Upload**: Send image with caption
- [ ] **Unknown Intent**: "hello" (should show help)
- [ ] **Unregistered User**: Test with unregistered WhatsApp number
- [ ] **Auto-Categorization**: Verify expenses are categorized correctly
- [ ] **Budget Warnings**: Exceed budget and check for warning

## Verify Database Records

After sending messages, check the database:

### Check whatsapp_messages table
```sql
SELECT * FROM whatsapp_messages 
WHERE user_id = 'your-user-id' 
ORDER BY received_at DESC 
LIMIT 10;
```

### Check expenses table
```sql
SELECT * FROM expenses 
WHERE user_id = 'your-user-id' 
AND source = 'whatsapp' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check tasks table
```sql
SELECT * FROM tasks 
WHERE user_id = 'your-user-id' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Common Issues

### Issue: "User not found" message
**Cause**: WhatsApp number not registered in database
**Solution**: 
1. Register user in dashboard
2. Ensure WhatsApp number format matches (e.g., "+256770123456")

### Issue: "No active project found"
**Cause**: User doesn't have an active project
**Solution**: Create a project in the dashboard with status "active"

### Issue: Expense not categorized
**Cause**: Description doesn't match any category keywords
**Solution**: 
1. Check keyword list in `intentParser.ts`
2. Add more keywords or update description

### Issue: Low confidence, goes to unknown handler
**Cause**: Message format not recognized
**Solution**: 
1. Add pattern to `intentParser.ts`
2. Implement AI fallback for complex messages

## Manual API Testing

### Test with curl

```bash
# Simulate Twilio webhook
curl -X POST http://localhost:5000/api/whatsapp/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "MessageSid=SMxxxx" \
  -d "AccountSid=ACxxxx" \
  -d "From=whatsapp:+256770123456" \
  -d "To=whatsapp:+14155238886" \
  -d "Body=spent 500 on cement" \
  -d "NumMedia=0"
```

### Test with Postman

1. Create new POST request to `http://localhost:5000/api/whatsapp/webhook`
2. Set body type to `x-www-form-urlencoded`
3. Add parameters:
   - MessageSid: SMxxxx
   - AccountSid: ACxxxx
   - From: whatsapp:+256770123456
   - To: whatsapp:+14155238886
   - Body: spent 500 on cement
   - NumMedia: 0
4. Send request

## Intent Parser Unit Tests

Test the intent parser directly:

```typescript
import { parseIntent } from './server/services/intentParser';

// Test expense logging
console.log(parseIntent("spent 500 on cement"));
// Expected: { intent: 'log_expense', amount: 500, description: 'cement', confidence: 0.95 }

// Test task creation
console.log(parseIntent("task: inspect foundation"));
// Expected: { intent: 'create_task', title: 'inspect foundation', confidence: 0.95 }

// Test budget setting
console.log(parseIntent("set budget 1000000"));
// Expected: { intent: 'set_budget', amount: 1000000, confidence: 0.95 }

// Test query
console.log(parseIntent("how much did I spend?"));
// Expected: { intent: 'query_expenses', confidence: 0.90 }

// Test unknown
console.log(parseIntent("hello there"));
// Expected: { intent: 'unknown', confidence: 0 }
```

## Production Testing

Before deploying to production:

1. **Test with Real Phone Numbers**: Use actual Ugandan phone numbers
2. **Test All Intents**: Go through complete testing checklist
3. **Test Error Scenarios**: Invalid data, missing projects, etc.
4. **Load Testing**: Send multiple messages rapidly
5. **Monitor Logs**: Check for errors in server logs
6. **Verify Twilio Costs**: Monitor message costs in Twilio console
7. **Test RLS**: Ensure users can only see their own data

## Monitoring

### Check Server Logs
```bash
# Watch server logs
tail -f server.log

# Filter WhatsApp-related logs
grep "WhatsApp Webhook" server.log
```

### Check Twilio Logs
1. Go to https://console.twilio.com/
2. Navigate to **Monitor** → **Logs** → **Messaging**
3. Check for delivery status and errors

### Database Monitoring
```sql
-- Count messages by intent
SELECT intent, COUNT(*) as count 
FROM whatsapp_messages 
WHERE received_at > NOW() - INTERVAL '24 hours'
GROUP BY intent 
ORDER BY count DESC;

-- Check error messages
SELECT * FROM whatsapp_messages 
WHERE error_message IS NOT NULL 
ORDER BY received_at DESC 
LIMIT 20;

-- Check processing times
SELECT 
  AVG(EXTRACT(EPOCH FROM (processed_at - received_at))) as avg_processing_seconds
FROM whatsapp_messages 
WHERE processed_at IS NOT NULL;
```

## Performance Benchmarks

Target response times:
- **Intent Parsing**: < 10ms
- **Database Query**: < 50ms
- **Total Processing**: < 200ms
- **Reply Sent**: < 500ms total

## Next Steps

After successful testing:
1. Deploy to production
2. Configure production Twilio webhook
3. Monitor for 24 hours
4. Gather user feedback
5. Iterate on patterns and responses


