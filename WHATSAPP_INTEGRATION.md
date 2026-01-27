# WhatsApp Integration Guide

## Overview

The BuildMonitor WhatsApp integration allows Ugandan contractors to manage expenses, tasks, and budgets directly from WhatsApp using natural language commands in both English and Luganda.

## Architecture

```
WhatsApp User → Twilio API → Webhook (POST /api/whatsapp/webhook) → Intent Parser → Handler → Database → Reply
```

## Components

### 1. **Intent Parser** (`server/services/intentParser.ts`)

Rule-based NLP parser that detects user intent from messages.

**Supported Intents:**
- `log_expense`: Extract expense amount and description
- `create_task`: Extract task title and priority
- `set_budget`: Extract budget amount
- `query_expenses`: User asking about expenses
- `log_image`: Image with optional caption
- `unknown`: Cannot determine intent

**Example Usage:**
```typescript
import { parseIntent } from './services/intentParser';

const parsed = parseIntent("spent 500 on cement");
// => { intent: 'log_expense', amount: 500, description: 'cement', confidence: 0.95 }
```

### 2. **WhatsApp Router** (`server/routes/whatsapp.ts`)

Express router that handles Twilio webhook and routes to intent handlers.

**Endpoint:** `POST /api/whatsapp/webhook`

**Request Format (Twilio):**
```javascript
{
  MessageSid: "SMxxxx",
  AccountSid: "ACxxxx",
  From: "whatsapp:+256770123456",
  To: "whatsapp:+14155238886",
  Body: "spent 500 on cement",
  NumMedia: "0"
}
```

**Flow:**
1. Validate webhook payload
2. Extract phone number (remove `whatsapp:` prefix)
3. Look up user by phone number
4. Log incoming message
5. Parse intent
6. Route to appropriate handler
7. Send reply via Twilio
8. Log outbound message

### 3. **Intent Handlers**

#### **Log Expense** (`handleLogExpense`)
- Finds user's default project
- Auto-categorizes expense (Materials, Labor, Equipment, Transport, Misc)
- Inserts expense record
- Calculates remaining budget
- Returns formatted confirmation

**Example Messages:**
- English: "spent 500 on cement", "paid 200 for bricks", "bought sand 150"
- Luganda: "nimaze 300 ku sand", "naguze cement 500"

**Reply Format:**
```
✅ Expense recorded!

📝 cement
💰 UGX 500
📊 Project: House Construction

💵 Remaining budget: UGX 4,500
```

#### **Create Task** (`handleCreateTask`)
- Creates task in user's default project
- Sets priority (low/medium/high)
- Returns task count

**Example Messages:**
- "task: inspect foundation"
- "todo: buy materials"
- "urgent: check workers"

**Reply Format:**
```
✅ Task created!

📋 inspect foundation
📊 Project: House Construction
⚡ Priority: medium

📝 You have 3 pending tasks.
```

#### **Set Budget** (`handleSetBudget`)
- Updates project budget_amount
- Shows current spending vs new budget
- Calculates remaining budget

**Example Messages:**
- "set budget 1000000"
- "my budget is 500000"

**Reply Format:**
```
✅ Budget updated!

📊 Project: House Construction
💰 New budget: UGX 1,000,000
💵 Already spent: UGX 500
💸 Remaining: UGX 999,500
```

#### **Query Expenses** (`handleQueryExpenses`)
- Calculates total spent, budget, and remaining
- Shows percentage used
- Lists top 3 expense categories
- Warns if over budget

**Example Messages:**
- "how much did I spend?"
- "show expenses"
- "total spent"

**Reply Format:**
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

#### **Log Image** (`handleLogImage`)
- Stores image metadata in `images` table
- Links to project (can link to expense later)
- Saves Twilio media URL

**Example:**
User sends image with caption "receipt for cement"

**Reply Format:**
```
✅ Image received!

📸 receipt for cement
📊 Project: House Construction

💡 Tip: Send expense amount to link this image to an expense.
```

#### **Unknown Intent** (`handleUnknown`)
- Fallback for unclear messages
- Sends helpful instructions
- TODO: Integrate OpenAI for AI-powered understanding

**Reply Format:**
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

## Setup

### 1. Environment Variables

Add to `.env`:
```bash
# Twilio Credentials
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Supabase Credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Dashboard URL (for registration prompts)
DASHBOARD_URL=https://buildmonitor.app
```

### 2. Twilio Webhook Configuration

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Messaging** → **Settings** → **WhatsApp Sandbox Settings** (for testing)
3. Set **When a message comes in** to:
   ```
   https://your-domain.com/api/whatsapp/webhook
   ```
4. Set HTTP method to **POST**
5. Click **Save**

### 3. Test the Integration

Send a WhatsApp message to your Twilio number:
```
spent 500 on cement
```

You should receive:
```
✅ Expense recorded!
...
```

## Auto-Categorization

The system automatically categorizes expenses based on keywords:

| Category | Keywords |
|----------|----------|
| **Materials** | cement, sand, bricks, steel, iron, timber, wood, stone, gravel, aggregate |
| **Labor** | worker, labour, labor, mason, carpenter, plumber, electrician, painter, wages, salary |
| **Equipment** | equipment, tools, machine, excavator, mixer, generator, scaffolding |
| **Transport** | transport, delivery, fuel, petrol, diesel, lorry, truck, vehicle |
| **Miscellaneous** | misc, other, sundry |

## Language Support

### English
- "spent 500 on cement"
- "paid 200 for bricks"
- "bought sand 150"
- "task: inspect foundation"
- "set budget 1000000"
- "how much did I spend?"

### Luganda
- "nimaze 300 ku sand" (I spent 300 on sand)
- "naguze cement 500" (I bought cement 500)
- "omaze 500" (you spent 500)

## User Registration Flow

If a user sends a message but isn't registered:

**User sends:** "spent 500 on cement"

**System replies:**
```
👋 Welcome to BuildMonitor!

Please register at https://buildmonitor.app to get started.

Once registered, you can track expenses, manage tasks, and monitor your construction projects via WhatsApp.
```

The message is logged with `intent: 'registration_required'` for analytics.

## Database Schema

### Tables Used

1. **profiles**: User accounts linked to WhatsApp numbers
2. **projects**: Construction projects
3. **expenses**: Expense records
4. **tasks**: Task management
5. **images**: Receipt/photo storage
6. **expense_categories**: Default categories
7. **whatsapp_messages**: Audit log of all interactions

### Message Logging

Every incoming and outgoing message is logged to `whatsapp_messages`:

```typescript
{
  userId: "uuid",
  whatsappMessageId: "SMxxxx", // Twilio message SID
  direction: "inbound" | "outbound",
  messageBody: "spent 500 on cement",
  mediaUrl: null,
  intent: "log_expense",
  processed: true,
  aiUsed: false,
  errorMessage: null,
  receivedAt: "2025-01-25T10:30:00Z",
  processedAt: "2025-01-25T10:30:02Z"
}
```

## Error Handling

All handlers use try-catch blocks with graceful fallbacks:

```typescript
try {
  // Handler logic
} catch (error) {
  console.error('[handleLogExpense] Error:', error);
  return `❌ Failed to log expense. Please try again or contact support.`;
}
```

## Testing Locally

1. **Install ngrok** (for local testing):
   ```bash
   npm install -g ngrok
   ```

2. **Start the server**:
   ```bash
   npm run dev
   ```

3. **Expose local server**:
   ```bash
   ngrok http 5000
   ```

4. **Update Twilio webhook** to ngrok URL:
   ```
   https://xxxx-xx-xxx.ngrok.io/api/whatsapp/webhook
   ```

5. **Send test messages** to your Twilio WhatsApp number

## Future Enhancements

### AI-Powered Fallback (OpenAI)
When confidence is low or intent is unknown, use OpenAI to:
- Understand complex or ambiguous messages
- Extract structured data from natural language
- Provide conversational responses

```typescript
// TODO: Implement in handleUnknown()
async function handleUnknownWithAI(userId: string, message: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "Extract expense data from message..." },
      { role: "user", content: message }
    ]
  });
  
  // Parse AI response and create expense
}
```

### Multi-Project Support
Allow users to specify which project:
- "spent 500 on cement for house project"
- "switch to office project"

### Receipt OCR
Use OCR to extract data from receipt images:
- Amount
- Vendor name
- Date
- Items

### Voice Messages
Transcribe WhatsApp voice messages and process as text.

## Troubleshooting

### Issue: Messages not received
**Solution:**
1. Check Twilio webhook URL is correct
2. Verify server is running and accessible
3. Check Twilio logs for errors

### Issue: User not found
**Solution:**
1. Ensure user registered with correct WhatsApp number
2. Check `profiles.whatsapp_number` format (e.g., "+256770123456")
3. Verify Supabase connection

### Issue: Low confidence parsing
**Solution:**
1. Add more pattern examples to `intentParser.ts`
2. Implement AI fallback for complex messages
3. Train users on supported message formats

## API Reference

### POST /api/whatsapp/webhook

Receives Twilio WhatsApp webhook.

**Headers:**
```
Content-Type: application/x-www-form-urlencoded
```

**Request Body (Twilio format):**
```
MessageSid=SMxxxx
AccountSid=ACxxxx
From=whatsapp:+256770123456
To=whatsapp:+14155238886
Body=spent 500 on cement
NumMedia=0
```

**Response:**
```xml
<Response></Response>
```

## Support

For issues or questions:
- Email: support@buildmonitor.app
- WhatsApp: Send "help" to get command list
- Dashboard: https://buildmonitor.app

## License

MIT License - See LICENSE file for details.


