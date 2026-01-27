# N8N WhatsApp Integration Guide for Construction Monitor Uganda

## Overview
This guide provides complete instructions for integrating your N8N WhatsApp agent with the Replit Construction Monitor dashboard. The system supports AI-powered data extraction from WhatsApp messages to automatically populate your construction dashboard with expenses, inventory, tasks, and daily spending data.

## How It Works

```
WhatsApp Message → n8n (AI extracts data) → Replit (stores in database) → Dashboard Updated
        ↑                    ↓                         ↓
   User sends          AI parses                Confirmation sent
  casual update      "50 bags cement           back via WhatsApp
                      500k from Musa"
                           ↓
                    {type: "expense",
                     item: "Cement",
                     amount: 500000,
                     supplier: "Musa"}
```

**The workflow:**
1. Site manager sends WhatsApp message: "bought 50 bags cement, 500k from Musa"
2. n8n receives message via WhatsApp Business Cloud API
3. n8n's AI node extracts structured data (type, amount, item, supplier, etc.)
4. n8n sends clean JSON to Replit endpoint
5. Replit stores in correct table and returns confirmation
6. n8n sends confirmation back to WhatsApp

## Table of Contents
1. [Recommended Approach: Pre-Extracted Data](#recommended-approach-pre-extracted-data)
2. [Quick Start](#quick-start)
3. [Authentication](#authentication)
4. [Extracted Data Endpoint (RECOMMENDED)](#extracted-data-endpoint-recommended)
5. [Sample AI Prompts for n8n](#sample-ai-prompts-for-n8n)
6. [Testing Examples](#testing-examples)
7. [Legacy Endpoints](#legacy-endpoints)
8. [Security Considerations](#security-considerations)

---

## Recommended Approach: Pre-Extracted Data

**Use this approach** - It's simpler, faster, and puts less load on both servers.

The `POST /api/webhooks/extracted-data` endpoint receives **already-parsed data** from n8n. Your n8n workflow uses its own AI node to extract structured fields from casual messages, then sends clean JSON to this endpoint.

**Benefits:**
- ✅ Simpler integration - just one HTTP request
- ✅ Lower server load - n8n does AI processing locally
- ✅ Better error handling - validation happens before storage
- ✅ Confirmation messages - ready to send back via WhatsApp
- ✅ No OpenAI API key needed on Replit side

---

## Extracted Data Endpoint (RECOMMENDED)

**POST** `/api/webhooks/extracted-data`

This is the main endpoint for receiving pre-extracted data from your n8n AI workflow.

### Supported Data Types

| Type | Description | Dashboard Section |
|------|-------------|-------------------|
| `expense` | Purchases, payments, costs | Daily Ledger → Line Items |
| `inventory` | Materials received/delivered | Inventory Management |
| `task` | Work items, todos, jobs | Task Board |
| `cash_deposit` | Money received from owner | Cash Deposits |
| `query` | Questions about project | Returns answer + data |

### Request Format

All requests require:
- `type`: One of the above data types
- `projectId`: UUID of the project (get from dashboard)
- `whatsappNumber`: Phone number in format `+256700123456`

### 1. EXPENSE (Most Common)

Records purchases in the daily ledger.

```json
{
  "type": "expense",
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
  "whatsappNumber": "+256700123456",
  "item": "Cement",
  "amount": 500000,
  "category": "Materials",
  "paymentMethod": "cash",
  "supplierName": "Musa Hardware",
  "quantity": 50,
  "unit": "bags",
  "note": "For foundation"
}
```

**Fields:**
| Field | Required | Type | Example |
|-------|----------|------|---------|
| item | ✅ Yes | string | "Cement", "Sand", "Labor" |
| amount | ✅ Yes | number | 500000 (in UGX) |
| category | Optional | string | "Materials", "Labor", "Transport" (default: "Materials") |
| paymentMethod | Optional | string | "cash" or "supplier" (default: "cash") |
| supplierName | Optional | string | "Musa Hardware" (creates supplier if doesn't exist) |
| quantity | Optional | number | 50 |
| unit | Optional | string | "bags", "pieces", "trips" |
| note | Optional | string | Any note |
| date | Optional | string | "2025-11-25" (default: today) |

**Response:**
```json
{
  "success": true,
  "type": "expense",
  "message": "Expense recorded successfully",
  "data": {"ledgerId": "...", "lineId": "..."},
  "confirmationMessage": "Recorded: Cement - UGX 500,000 (cash) (50 bags)"
}
```

### 2. INVENTORY

Records materials received on site or at hardware.

```json
{
  "type": "inventory",
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
  "whatsappNumber": "+256700123456",
  "item": "Iron bars",
  "quantity": 100,
  "unit": "pieces",
  "supplierName": "Musa Hardware",
  "location": "on-site"
}
```

**Fields:**
| Field | Required | Type | Example |
|-------|----------|------|---------|
| item | ✅ Yes | string | "Iron bars", "Cement", "Bricks" |
| quantity | ✅ Yes | number | 100 |
| unit | Optional | string | "pieces", "bags", "trips" (default: "pieces") |
| supplierName | Optional | string | "Musa Hardware" |
| location | Optional | string | "on-site" or "hardware" (default: "on-site") |
| date | Optional | string | "2025-11-25" (default: today) |

**Response:**
```json
{
  "success": true,
  "type": "inventory",
  "confirmationMessage": "Inventory recorded: 100 pieces of Iron bars on-site from Musa Hardware"
}
```

### 3. TASK

Creates a task on the project task board.

```json
{
  "type": "task",
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
  "whatsappNumber": "+256700123456",
  "title": "Pour foundation slab",
  "description": "Mix concrete and pour the main slab",
  "priority": "High",
  "location": "Site A"
}
```

**Fields:**
| Field | Required | Type | Example |
|-------|----------|------|---------|
| title | ✅ Yes | string | "Pour foundation slab" |
| description | Optional | string | Any description |
| priority | Optional | string | "Low", "Medium", "High" (default: "Medium") |
| location | Optional | string | "Site A", "Building 1" |
| dueDate | Optional | string | "2025-11-30" |

**Response:**
```json
{
  "success": true,
  "type": "task",
  "confirmationMessage": "🔴 Task added: \"Pour foundation slab\" at Site A"
}
```

### 4. CASH DEPOSIT

Records money sent from owner to site manager.

```json
{
  "type": "cash_deposit",
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
  "whatsappNumber": "+256700123456",
  "amount": 1000000,
  "method": "Mobile Money",
  "reference": "MM123456",
  "note": "Funds for next week materials"
}
```

**Fields:**
| Field | Required | Type | Example |
|-------|----------|------|---------|
| amount | ✅ Yes | number | 1000000 |
| method | Optional | string | "Mobile Money", "Bank Transfer", "Cash Handover" |
| reference | Optional | string | Transaction reference |
| note | Optional | string | Any note |
| date | Optional | string | "2025-11-25" (default: today) |

**Response:**
```json
{
  "success": true,
  "type": "cash_deposit",
  "confirmationMessage": "Cash deposit recorded: UGX 1,000,000 via Mobile Money"
}
```

### 5. QUERY

Asks a question about the project and returns relevant data.

```json
{
  "type": "query",
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
  "whatsappNumber": "+256700123456",
  "question": "how much have we spent on this project?"
}
```

**Supported Questions:**
- Budget/spending: "how much spent?", "what's the budget?", "cash balance?"
- Tasks: "pending tasks?", "what's left to do?"
- Inventory: "what materials do we have?", "stock levels?"
- Daily spending: "what did we spend today?"

**Response:**
```json
{
  "success": true,
  "type": "query",
  "confirmationMessage": "📊 Project Budget:\n• Total: UGX 10,000,000\n• Spent: UGX 7,811,000 (78.1%)\n• Remaining: UGX 2,189,000\n• Cash on hand: UGX -6,410,000"
}
```

---

## Sample AI Prompts for n8n

Use this prompt in your n8n AI Agent or AI Chain node to extract structured data from casual WhatsApp messages.

### Recommended System Prompt

```
You are a construction project assistant that extracts structured data from casual WhatsApp messages sent by site managers in Uganda.

Extract the following fields from each message and output valid JSON:

{
  "type": "expense" | "inventory" | "task" | "cash_deposit" | "query",
  "item": "item name if applicable",
  "amount": number (in UGX, no commas),
  "quantity": number if mentioned,
  "unit": "bags" | "pieces" | "trips" | "sheets" etc,
  "category": "Materials" | "Labor" | "Transport" | "Services" | "Equipment",
  "paymentMethod": "cash" | "supplier",
  "supplierName": "supplier name if mentioned",
  "location": "site location if mentioned",
  "priority": "Low" | "Medium" | "High" for tasks,
  "title": "task title for tasks",
  "description": "additional details",
  "question": "the question if type is query"
}

Common patterns:
- "bought X from Y" → expense with supplierName
- "received X bags of Y" → inventory
- "paid X for Y" → expense
- "need to do X" or "tomorrow we must X" → task
- "boss sent 1M" → cash_deposit
- "how much have we spent?" → query

Uganda currency notes:
- "500k" = 500000
- "1M" = 1000000
- "50k" = 50000

Always include projectId and whatsappNumber from the context (these will be provi
heded).
Only output valid JSON, no explanations.
```

### Example Extractions

**Message:** "bought 50 bags cement 500k from Musa"
```json
{
  "type": "expense",
  "item": "Cement",
  "amount": 500000,
  "quantity": 50,
  "unit": "bags",
  "category": "Materials",
  "paymentMethod": "supplier",
  "supplierName": "Musa"
}
```

**Message:** "got 100 iron bars delivered from kampala steel"
```json
{
  "type": "inventory",
  "item": "Iron bars",
  "quantity": 100,
  "unit": "pieces",
  "supplierName": "Kampala Steel",
  "location": "on-site"
}
```

**Message:** "paid workers 300k for plastering"
```json
{
  "type": "expense",
  "item": "Plastering labor",
  "amount": 300000,
  "category": "Labor",
  "paymentMethod": "cash"
}
```

**Message:** "need to finish roofing by Friday"
```json
{
  "type": "task",
  "title": "Finish roofing",
  "priority": "High",
  "dueDate": "2025-11-29"
}
```

**Message:** "boss sent 2M on mobile money"
```json
{
  "type": "cash_deposit",
  "amount": 2000000,
  "method": "Mobile Money"
}
```

---

## Testing Examples

Test with curl:

```bash
# Test expense
curl -X POST https://your-app.replit.dev/api/webhooks/extracted-data \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN" \
  -d '{
    "type": "expense",
    "projectId": "YOUR_PROJECT_ID",
    "whatsappNumber": "+256700123456",
    "item": "Cement",
    "amount": 500000,
    "category": "Materials",
    "paymentMethod": "cash",
    "quantity": 50,
    "unit": "bags"
  }'

# Test inventory
curl -X POST https://your-app.replit.dev/api/webhooks/extracted-data \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN" \
  -d '{
    "type": "inventory",
    "projectId": "YOUR_PROJECT_ID",
    "whatsappNumber": "+256700123456",
    "item": "Iron bars",
    "quantity": 100,
    "unit": "pieces",
    "location": "on-site"
  }'

# Test query
curl -X POST https://your-app.replit.dev/api/webhooks/extracted-data \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN" \
  -d '{
    "type": "query",
    "projectId": "YOUR_PROJECT_ID",
    "whatsappNumber": "+256700123456",
    "question": "how much have we spent?"
  }'
```

---

## n8n Workflow Setup (Step-by-Step)

### Complete Workflow Structure

```
1. [Trigger] Webhook Node - Receives WhatsApp message
2. [AI] AI Agent/Chain - Extracts structured data
3. [Code] Set Node - Add projectId and whatsappNumber
4. [HTTP] HTTP Request - POST to Replit endpoint
5. [WhatsApp] WhatsApp Business Cloud - Send confirmation back
```

### Node Configuration

#### 1. Webhook Node
- **Method:** POST
- **Path:** `/whatsapp-message`
- **Authentication:** None (WhatsApp handles this)

#### 2. AI Agent Node
- **Model:** GPT-4o-mini (or your preferred model)
- **System Prompt:** Use the prompt from above
- **Input:** `{{ $json.body.entry[0].changes[0].value.messages[0].text.body }}`

#### 3. Set Node (Add Context)
```javascript
{
  ...JSON.parse($json.output),
  "projectId": "YOUR_PROJECT_ID",
  "whatsappNumber": $json.body.entry[0].changes[0].value.messages[0].from
}
```

#### 4. HTTP Request Node
- **Method:** POST
- **URL:** `https://your-app.replit.dev/api/webhooks/extracted-data`
- **Authentication:** Header Auth
  - Name: `Authorization`
  - Value: `Bearer YOUR_SECRET_TOKEN`
- **Body:** `{{ $json }}`

#### 5. WhatsApp Business Cloud Node
- **Phone Number ID:** Your WhatsApp Business Phone ID
- **Recipient:** `{{ $('Webhook').item.json.body.entry[0].changes[0].value.messages[0].from }}`
- **Message Type:** Text
- **Message:** `{{ $json.confirmationMessage }}`

---

## Quick Start

### 1. Get Your Credentials
- **Webhook URL**: `https://your-replit-app.replit.dev/api/webhook/n8n`
- **Auth Token**: Check environment variable `N8N_WEBHOOK_SECRET` (default: `n8n-webhook-secret-change-in-production`)
- **Project ID**: Get from your dashboard URL or database (format: UUID like `96a84a56-e36d-4dcf-b339-3d19e28b7358`)

### 2. Test the Connection
Visit: `https://your-replit-app.replit.dev/api/webhook/test`

This shows:
- ✅ Webhook status
- ✅ Example payloads
- ✅ Curl commands for testing
- ✅ N8N configuration

---

## Authentication

All webhook requests require Bearer token authentication.

### Headers Required
```
Content-Type: application/json
Authorization: Bearer YOUR_SECRET_TOKEN
```

### Example Request
```bash
curl -X POST https://your-replit-app.replit.dev/api/webhook/n8n \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer n8n-webhook-secret-change-in-production" \
  -d '{"type": "expense", "projectId": "YOUR_PROJECT_ID", "data": {...}}'
```

---

## Webhook Endpoints

### Main Webhook Endpoint
**POST** `/api/webhook/n8n`

Accepts all data types from WhatsApp conversations.

**Response Format:**
```json
{
  "success": true,
  "message": "Expense created: Cement - 500000 UGX",
  "data": { ... },
  "recordId": "abc-123-def-456",
  "metadata": {
    "type": "expense",
    "timestamp": "2025-10-30T12:00:00.000Z",
    "conversationId": "optional-id"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [...],
  "timestamp": "2025-10-30T12:00:00.000Z"
}
```

### Test Endpoint
**GET** `/api/webhook/test`

Returns documentation and test examples. No authentication required.

---

## WhatsApp & AI Endpoints (NEW)

These new endpoints enable natural language conversation, message history tracking, and AI-powered responses using OpenAI and RAG.

### Prerequisites

**Required Environment Variables:**
```bash
# OpenAI API Key for AI responses
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx

# Webhook secret (same as above)
N8N_WEBHOOK_SECRET=your-secure-secret-here

# Optional: Model selection (default: gpt-4o-mini)
OPENAI_MODEL=gpt-4o-mini
```

### Security Considerations

**CRITICAL SECURITY WARNINGS:**

#### Trust Model & Limitations

This integration uses a **shared webhook secret** authentication model, which has important security implications:

**Current Security Model:**
- n8n holds the webhook secret
- n8n is trusted to verify WhatsApp phone numbers
- The Replit backend trusts that n8n sends verified phone numbers
- Anyone with the webhook secret can impersonate any phone number

**CRITICAL VULNERABILITIES:**
1. **Shared Secret Risk**: The `N8N_WEBHOOK_SECRET` grants full access to all WhatsApp/RAG/AI endpoints. If compromised:
   - Attackers can impersonate any WhatsApp number
   - Attackers can query any project data (if they know the project ID)
   - Attackers can create fake message history

2. **No Request Signing**: Requests are not cryptographically signed, so:
   - Cannot verify requests actually came from n8n
   - Cannot prevent replay attacks
   - Cannot verify the authenticity of phone numbers

3. **Project ID Exposure**: If an attacker knows a project ID and has the webhook secret:
   - They can query that project's data via RAG
   - They can generate AI responses about that project
   - They can create fake WhatsApp messages linked to that project

4. **Global Resources**: Suppliers are not project-scoped:
   - RAG queries can expose supplier data from all projects
   - Multi-tenant deployments have cross-tenant data leakage risk

**REQUIRED PRODUCTION HARDENING:**

1. **IP Whitelisting** (CRITICAL):
   ```bash
   # Only allow requests from your n8n server IP
   # Add to Express middleware before webhook routes
   ```

2. **Request Signing** (STRONGLY RECOMMENDED):
   - Implement HMAC signature verification
   - n8n signs each request with timestamp
   - Replit verifies signature and timestamp (prevent replay)

3. **Webhook Token Security** (REQUIRED):
   - Use a strong, random token (minimum 64 characters)
   - Rotate monthly or after any suspected compromise
   - Never commit to version control
   - Store in environment variables only
   - Use different tokens for dev/staging/production

4. **Rate Limiting** (REQUIRED):
   - Implement per-IP rate limiting (e.g., express-rate-limit)
   - Limit: 20 requests per minute per IP address
   - Add per-WhatsApp-number rate limiting
   - Limit: 10 requests per minute per phone number

5. **Project-User Mapping** (RECOMMENDED):
   - Create explicit user-project access control lists
   - Verify WhatsApp users have explicit project access grants
   - Don't rely solely on `project.ownerId` matching

6. **Audit Logging** (REQUIRED):
   - Log all webhook requests with IP, timestamp, phone number
   - Monitor for unusual patterns (many different projects from one IP)
   - Set up alerts for failed authorization attempts

7. **Data Scoping** (REQUIRED):
   - Add project scoping to suppliers table
   - Limit RAG queries to explicitly authorized projects
   - Implement database-level row security policies

**Current Protections (Limited):**
- ✅ Project ownership verification (`project.ownerId` matches user)
- ✅ RAG result limits (10 per source)
- ✅ AI endpoint rejects unrecognized phone numbers
- ✅ Concurrent user creation handled
- ❌ No IP whitelisting
- ❌ No request signing
- ❌ No rate limiting
- ❌ No per-project access grants
- ❌ No supplier scoping

**Recommended Architecture for Production:**

```
WhatsApp → n8n (verifies number) → Request Signer → IP Whitelist → Rate Limiter → Auth Check → Replit API
```

**Alternative: Use Authenticated API Instead**

For better security, consider using authenticated user sessions instead of webhook tokens:
1. Users log in to web dashboard
2. Users link their WhatsApp number in settings
3. n8n calls authenticated API with user's session token
4. Full multi-tenant security with proper auth

**Deployment Warning:**

⚠️ **DO NOT deploy this integration to production** without implementing:
1. IP whitelisting for n8n server
2. Rate limiting middleware
3. Request signature verification
4. Comprehensive audit logging

The current implementation is suitable for:
- Development/testing environments
- Single-tenant deployments with trusted n8n
- Proof-of-concept demonstrations

For multi-tenant production use, additional security measures are REQUIRED.

### 1. WhatsApp Message Webhook
**POST** `/api/webhooks/whatsapp`

Receives WhatsApp messages, stores them, links to users/projects, and returns smart replies.

**Request:**
```json
{
  "whatsappNumber": "+256700123456",
  "messageType": "text",
  "text": "Boss, we bought 50 bags cement today, 500k",
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358"
}
```

**Response:**
```json
{
  "success": true,
  "replyText": "Thanks! Your update for Main Office Building has been recorded.",
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
  "projectName": "Main Office Building",
  "userId": "user-uuid",
  "messageId": "message-uuid",
  "timestamp": "2025-11-17T10:30:01Z"
}
```

**Field Details:**
- `whatsappNumber`: User's phone number in E.164 format (required)
- `messageType`: text, voice, image, pdf, document (default: text)
- `text`: Message content or transcribed voice (optional)
- `mediaUrl`: URL to media file (optional)
- `fileName`: Original filename (optional)
- `projectId`: Project UUID (optional - if omitted, system asks user)

**Features:**
- Automatically creates users on first message
- Stores conversation history
- Links messages to projects
- Returns contextual confirmation

### 2. RAG Query Endpoint
**POST** `/api/rag/query`

Retrieves relevant project context for AI-powered question answering.

**Request:**
```json
{
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
  "query": "How much cement do we have left?"
}
```

**Response:**
```json
{
  "success": true,
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
  "query": "How much cement do we have left?",
  "context": "Project: Main Office Building\n\n- Cement: 45 bags remaining (75 used, 120 total)",
  "chunks": [
    {
      "sourceId": "inventory-uuid",
      "excerpt": "Cement: 45 bags remaining (75 used, 120 total)",
      "metadata": {
        "type": "inventory",
        "item": "Cement",
        "quantity": 120,
        "remaining": 45,
        "used": 75
      }
    }
  ],
  "timestamp": "2025-11-17T10:30:01Z"
}
```

**RAG Features:**
- Smart keyword detection (spend, task, inventory, supplier, daily)
- Retrieves relevant expenses, tasks, inventory, ledgers, suppliers
- Returns formatted context + structured chunks
- Optimized for LLM consumption

### 3. AI Answer Endpoint
**POST** `/api/ai/answer`

Generates intelligent responses using OpenAI with project context and conversation history.

**Request:**
```json
{
  "whatsappNumber": "+256700123456",
  "message": "How much cement do we have left?",
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358"
}
```

**Response:**
```json
{
  "success": true,
  "answer": "Based on the inventory, you have 45 bags of cement remaining at the on-site location.",
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
  "userId": "user-uuid",
  "aiUsage": {
    "model": "gpt-4o-mini",
    "totalTokens": 250
  },
  "timestamp": "2025-11-17T10:30:01Z"
}
```

**Features:**
- Uses RAG to fetch relevant project data
- Includes recent conversation history for context
- Stores both question and answer in database
- Supports follow-up questions
- Exponential backoff retry on API errors

### 4. Message History
**GET** `/api/messages`

Retrieve message history (requires user authentication).

**Query Parameters:**
```
?projectId=xxx&userId=xxx&limit=50&direction=incoming
```

**Response:**
```json
{
  "success": true,
  "messages": [...],
  "count": 50,
  "timestamp": "2025-11-17T10:30:01Z"
}
```

### 5. User Conversation History
**GET** `/api/users/:id/history`

Get conversation history for a specific user (requires authentication).

**Example:**
```
GET /api/users/user-uuid/history?limit=20
```

### 6. Health Check
**GET** `/api/health`

Check system status and connectivity (public endpoint).

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-11-17T10:30:01Z",
  "database": "connected",
  "services": {
    "api": "operational",
    "whatsapp": "operational",
    "ai": "configured"
  }
}
```

### Testing AI Endpoints

**Test WhatsApp Webhook:**
```bash
curl -X POST https://your-replit-app.replit.dev/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer n8n-webhook-secret-change-in-production" \
  -d '{
    "whatsappNumber": "+256700123456",
    "messageType": "text",
    "text": "Test message from site"
  }'
```

**Test RAG Query:**
```bash
curl -X POST https://your-replit-app.replit.dev/api/rag/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer n8n-webhook-secret-change-in-production" \
  -d '{
    "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
    "query": "How much did we spend this week?"
  }'
```

**Test AI Answer:**
```bash
curl -X POST https://your-replit-app.replit.dev/api/ai/answer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer n8n-webhook-secret-change-in-production" \
  -d '{
    "whatsappNumber": "+256700123456",
    "message": "What tasks are pending?",
    "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358"
  }'
```

**Test Health:**
```bash
curl https://your-replit-app.replit.dev/api/health
```

---

## Data Types & Examples

### 1. Historical Expenses
**Type:** `expense`

Use for: Material purchases, one-time costs, historical data import

**Request:**
```json
{
  "type": "expense",
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
  "data": {
    "category": "Materials",
    "description": "Cement",
    "amount": 500000,
    "quantity": 50,
    "unit": "bags",
    "supplier": "Musa Hardware",
    "phaseId": "foundation-phase-id",
    "date": "2025-10-30"
  },
  "metadata": {
    "source": "whatsapp",
    "conversationId": "chat-123"
  }
}
```

**Field Details:**
- `category`: Materials, Labor, Transport, Equipment, Other
- `description`: Item name or expense description
- `amount`: Number (will be converted to string in database)
- `quantity`: Optional number
- `unit`: Optional (bags, tons, liters, pieces, etc.)
- `supplier`: Optional supplier name
- `phaseId`: Optional phase UUID (Foundation, Walls, Roofing, Finishing)
- `date`: Optional ISO date string (defaults to today)

**WhatsApp Example:**
```
Manager: "Boss, we bought 50 bags cement today, 500k from Musa"

AI extracts:
- description: "Cement"
- amount: 500000
- quantity: 50
- unit: "bags"
- supplier: "Musa Hardware"
```

---

### 2. Inventory Tracking
**Type:** `inventory`

Use for: Material deliveries, stock tracking

**Request:**
```json
{
  "type": "inventory",
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
  "data": {
    "item": "Cement",
    "quantity": 100,
    "unit": "bags",
    "location": "on-site",
    "deliveryDate": "2025-10-30",
    "supplierId": "supplier-uuid"
  }
}
```

**Field Details:**
- `item`: Material name (required)
- `quantity`: Number of units (required)
- `unit`: Measurement unit (optional)
- `location`: "on-site" or "hardware" (defaults to "on-site")
- `deliveryDate`: ISO date (defaults to today)
- `used`: Optional number of units already used
- `remaining`: Auto-calculated if not provided
- `supplierId`: Optional UUID of supplier

**WhatsApp Example:**
```
Manager: "Received 100 bags cement at site from Musa"

AI extracts:
- item: "Cement"
- quantity: 100
- unit: "bags"
- location: "on-site"
```

---

### 3. Task Creation
**Type:** `task`

Use for: Reminders, work assignments, inspections

**Request:**
```json
{
  "type": "task",
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
  "data": {
    "title": "Inspect foundation work",
    "description": "Check concrete curing and alignment",
    "priority": "High",
    "dueDate": "2025-10-31",
    "location": "Site A - Foundation area"
  }
}
```

**Field Details:**
- `title`: Task name (required)
- `description`: Optional details
- `priority`: "Low", "Medium", "High" (defaults to "Medium")
- `dueDate`: Optional ISO date
- `location`: Optional location description
- `completed`: Boolean (defaults to false)

**WhatsApp Example:**
```
Manager: "Remind me to inspect foundation tomorrow"

AI extracts:
- title: "Inspect foundation work"
- dueDate: tomorrow's date
- priority: "High"
```

---

### 4. Daily Ledger Entries
**Type:** `daily_ledger`

Use for: Daily expenses, worker payments, accountability tracking

**Request:**
```json
{
  "type": "daily_ledger",
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
  "data": {
    "category": "Labor",
    "item": "Workers payment",
    "amount": 150000,
    "paymentMethod": "cash",
    "phaseId": "foundation-phase-id"
  }
}
```

**Field Details:**
- `category`: Labor, Materials, Transport, Equipment, Other
- `item`: Description of expense (required)
- `amount`: Number (required)
- `paymentMethod`: "cash" or "supplier" (defaults to "cash")
- `supplierId`: Optional UUID if paid to supplier
- `phaseId`: Optional phase UUID
- `quantity`: Optional number
- `unit`: Optional unit
- `note`: Optional notes

**Special Behavior:**
- Auto-creates daily ledger for today if it doesn't exist
- Updates ledger totals automatically
- Tracks cash vs supplier payments separately

**WhatsApp Example:**
```
Manager: "Today we paid workers 150k cash"

AI extracts:
- category: "Labor"
- item: "Workers payment"
- amount: 150000
- paymentMethod: "cash"
```

---

### 5. Supplier Management
**Type:** `supplier`

Use for: Adding new suppliers

**Request:**
```json
{
  "type": "supplier",
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
  "data": {
    "name": "Musa Hardware",
    "totalDeposited": 0,
    "totalSpent": 0,
    "currentBalance": 0
  }
}
```

**Field Details:**
- `name`: Supplier name (required)
- `totalDeposited`: Initial deposit amount (optional, defaults to 0)
- `totalSpent`: Initial spent amount (optional, defaults to 0)
- `currentBalance`: Current balance (optional, auto-calculated)

---

### 6. Query Operations
**Type:** `query`

Use for: Reporting, summaries, "What did we spend?" questions

**Request:**
```json
{
  "type": "query",
  "projectId": "96a84a56-e36d-4dcf-b339-3d19e28b7358",
  "data": {
    "queryType": "daily_spending"
  }
}
```

**Available Query Types:**

#### `daily_spending`
Returns today's total spending with breakdown

**Response:**
```json
{
  "success": true,
  "message": "Query processed",
  "data": {
    "message": "Today's spending: 650,000 UGX",
    "total": 650000,
    "items": 5,
    "breakdown": [
      {
        "category": "Labor",
        "description": "Workers payment",
        "amount": 150000
      },
      {
        "category": "Materials",
        "description": "Cement",
        "amount": 500000
      }
    ]
  }
}
```

#### `weekly_spending`
Returns last 7 days spending

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Last 7 days spending: 2,300,000 UGX",
    "total": 2300000,
    "items": 23
  }
}
```

#### `inventory_status`
Returns current inventory levels

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Inventory: 15 items",
    "items": [
      {
        "item": "Cement",
        "quantity": 100,
        "remaining": 75,
        "used": 25
      }
    ]
  }
}
```

#### `project_summary`
Returns budget and spending overview

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Project summary",
    "budget": 50000000,
    "totalSpent": 12000000,
    "remaining": 38000000,
    "percentUsed": 24
  }
}
```

---

## Update Operations

Use existing REST endpoints for corrections and updates.

### Update Historical Expense
**PUT** `/api/historical-expenses/:id`

```bash
curl -X PUT https://your-replit-app.replit.dev/api/historical-expenses/expense-id \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "amount": 450000,
    "quantity": 45
  }'
```

### Update Inventory Item
**PUT** `/api/inventory/:id`

```bash
curl -X PUT https://your-replit-app.replit.dev/api/inventory/inventory-id \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "used": 30,
    "remaining": 70
  }'
```

### Update Daily Ledger
**PUT** `/api/daily-ledgers/:id`

```bash
curl -X PUT https://your-replit-app.replit.dev/api/daily-ledgers/ledger-id \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "closingCash": 50000
  }'
```

---

## Testing & Debugging

### Step 1: Test Basic Connection
```bash
curl https://your-replit-app.replit.dev/api/webhook/test
```

Expected: JSON response with documentation and examples.

### Step 2: Test Authentication
```bash
curl -X POST https://your-replit-app.replit.dev/api/webhook/n8n \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer WRONG_TOKEN" \
  -d '{"type": "expense", "projectId": "test", "data": {}}'
```

Expected: 403 error with "Invalid webhook token" message.

### Step 3: Test Expense Creation
```bash
curl -X POST https://your-replit-app.replit.dev/api/webhook/n8n \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer n8n-webhook-secret-change-in-production" \
  -d '{
    "type": "expense",
    "projectId": "YOUR_ACTUAL_PROJECT_ID",
    "data": {
      "category": "Materials",
      "description": "Test cement purchase",
      "amount": 10000
    }
  }'
```

Expected: Success response with `recordId`.

### Step 4: Verify in Dashboard
1. Open your Replit app
2. Go to Financials page
3. Check Historical Expenses tab
4. Look for "Test cement purchase" entry

### Common Errors

**401 Unauthorized**
- Missing Authorization header
- Add: `-H "Authorization: Bearer YOUR_TOKEN"`

**403 Forbidden**
- Wrong token
- Check environment variable N8N_WEBHOOK_SECRET

**400 Bad Request - "Invalid webhook type"**
- Typo in type field
- Must be exactly: expense, inventory, task, daily_ledger, supplier, query

**400 Bad Request - Validation errors**
- Missing required fields
- Check response `details` field for specific errors

**404 Project not found**
- Wrong projectId
- Get correct UUID from database or dashboard

---

## N8N Workflow Setup

### Required N8N Nodes

1. **WhatsApp Trigger** (or Twilio)
2. **OpenAI Chat Model**
3. **Code Node** (for data extraction)
4. **HTTP Request Node** (to Replit webhook)
5. **IF Node** (for conditional logic)
6. **WhatsApp Send Message**

### HTTP Request Node Configuration

**Method:** POST

**URL:** `{{$env.REPLIT_WEBHOOK_URL}}/api/webhook/n8n`

**Authentication:** Header Auth
- Name: `Authorization`
- Value: `Bearer {{$env.N8N_WEBHOOK_SECRET}}`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "type": "{{ $json.dataType }}",
  "projectId": "{{ $env.PROJECT_ID }}",
  "data": "{{ $json.extractedData }}",
  "metadata": {
    "source": "whatsapp",
    "conversationId": "{{ $json.conversationId }}"
  }
}
```

### OpenAI System Prompt Example

```
You are Kato, a friendly construction site assistant for Uganda.

YOUR JOB:
- Help site managers report daily expenses, materials, and progress
- Extract structured data from casual conversation
- Always confirm details before saving

DATA TO EXTRACT:
When someone mentions:
- "bought cement 500k" → expense
- "received 100 bags" → inventory
- "remind me to inspect" → task
- "paid workers 150k" → daily_ledger

EXTRACTION FORMAT:
Return JSON with these fields:
{
  "dataType": "expense|inventory|task|daily_ledger",
  "extractedData": {
    "description": "...",
    "amount": 500000,
    "quantity": 50,
    "unit": "bags",
    "supplier": "Musa Hardware"
  },
  "confidence": "high|medium|low",
  "needsConfirmation": true
}

If low confidence, ask clarifying questions.
Always summarize before sending to database.
```

### Code Node Example (Data Extraction)

```javascript
// Extract structured data from AI response
const aiResponse = $input.item.json;
const message = $input.item.json.originalMessage;

// Parse AI extraction
let extractedData = {};
try {
  extractedData = JSON.parse(aiResponse.extraction);
} catch (e) {
  extractedData = aiResponse;
}

// Determine data type
let dataType = 'expense'; // default
if (message.toLowerCase().includes('received') || 
    message.toLowerCase().includes('delivered')) {
  dataType = 'inventory';
} else if (message.toLowerCase().includes('remind') || 
           message.toLowerCase().includes('task')) {
  dataType = 'task';
} else if (message.toLowerCase().includes('today') || 
           message.toLowerCase().includes('paid workers')) {
  dataType = 'daily_ledger';
}

return {
  json: {
    dataType,
    extractedData,
    conversationId: $input.item.json.from,
    readyToSend: extractedData.confidence === 'high'
  }
};
```

### Approval Workflow Logic

```
1. WhatsApp → Receive message
2. AI → Extract data
3. IF confidence == 'high'
   → WhatsApp → Confirm with manager
   → Wait for YES/NO
   → IF YES:
      → WhatsApp → Forward to owner
      → Wait for owner approval
      → IF owner says YES:
         → HTTP → Send to Replit
         → WhatsApp → Confirm success
```

---

## Environment Variables Setup

Add to N8N environment:

```env
REPLIT_WEBHOOK_URL=https://your-replit-app.replit.dev
N8N_WEBHOOK_SECRET=n8n-webhook-secret-change-in-production
PROJECT_ID=96a84a56-e36d-4dcf-b339-3d19e28b7358
```

---

## Success Checklist

✅ Can send test request with curl  
✅ Receives proper authentication error with wrong token  
✅ Creates expense that appears in dashboard  
✅ Creates inventory item that appears in dashboard  
✅ Query returns correct daily spending  
✅ N8N HTTP node configured correctly  
✅ AI prompt extracts data accurately  
✅ Approval workflow works end-to-end  

---

## Support & Debugging

### Check Webhook Logs
Webhook activity is logged on the server. Check Replit logs for:
```
[N8N Webhook] expense - Expense created: Cement - 500000 UGX
```

### Common Integration Issues

**Issue:** Data not appearing in dashboard  
**Fix:** Check that projectId matches actual project in database

**Issue:** Amount showing as 0  
**Fix:** Send amount as number, not string: `500000` not `"500000"`

**Issue:** Phase not linking  
**Fix:** Get correct phaseId UUID from `/api/construction-phases` endpoint

**Issue:** Supplier not linking  
**Fix:** Create supplier first, then use returned UUID in expense data

---

## Next Steps

1. ✅ Test webhook with curl commands
2. ✅ Verify data appears in dashboard  
3. ✅ Set up N8N HTTP Request node
4. ✅ Configure OpenAI with extraction prompt
5. ✅ Build approval workflow logic
6. ✅ Test end-to-end with WhatsApp
7. ✅ Add error handling and confirmations
8. ✅ Deploy to production

---

**Questions?** Check `/api/webhook/test` endpoint for live examples and documentation.
