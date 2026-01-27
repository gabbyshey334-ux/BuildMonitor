# Supabase Helper Library - Usage Guide

## 📦 Import

```typescript
import {
  supabase,
  getUserByWhatsApp,
  getUserDefaultProject,
  logWhatsAppMessage,
  logAIUsage,
  createUserProfile,
  updateUserLastActive,
  getUserExpenseCategories,
  getProjectSummary,
  testConnection,
} from './lib/supabase';
```

## 🔧 Functions

### 1. `getUserByWhatsApp(phoneNumber: string)`

Get user profile by WhatsApp phone number.

```typescript
// Example: Lookup user from incoming WhatsApp message
const { data: user, error } = await getUserByWhatsApp('+256771234567');

if (error) {
  console.error('Failed to lookup user:', error);
  return;
}

if (!user) {
  console.log('User not found - new user!');
  // Create new user profile
} else {
  console.log(`Found user: ${user.full_name}`);
}
```

**Parameters:**
- `phoneNumber` - WhatsApp number (e.g., `+256771234567`)

**Returns:**
```typescript
{
  data: Profile | null,
  error: Error | null
}
```

**Notes:**
- Automatically normalizes phone numbers (adds `+` if missing)
- Only returns active users (where `deleted_at IS NULL`)
- Returns `{ data: null, error: null }` if user not found (not an error)

---

### 2. `getUserDefaultProject(userId: string)`

Get user's most recently active project.

```typescript
// Example: Get user's default project for expense logging
const { data: project, error } = await getUserDefaultProject(userId);

if (error) {
  console.error('Failed to get default project:', error);
  return;
}

if (!project) {
  console.log('User has no active projects');
  // Guide user to create a project
} else {
  console.log(`Default project: ${project.name}`);
  // Log expense to this project
}
```

**Parameters:**
- `userId` - User's profile ID (UUID)

**Returns:**
```typescript
{
  data: Project | null,
  error: Error | null
}
```

**Notes:**
- Returns the most recently updated active project
- Only returns projects where `status = 'active'` and `deleted_at IS NULL`
- Returns `null` if no active projects (user should create one)

---

### 3. `logWhatsAppMessage(messageData: WhatsAppMessageData)`

Log WhatsApp message to audit table.

```typescript
// Example: Log incoming WhatsApp message
const { data: message, error } = await logWhatsAppMessage({
  user_id: user.id,
  whatsapp_message_id: 'WAmsg_abc123',
  direction: 'inbound',
  message_body: 'Cement 10 bags 50000',
  media_url: null,
  intent: 'log_expense',
  processed: false,
  ai_used: false,
});

if (error) {
  console.error('Failed to log message:', error);
  return;
}

console.log(`Message logged: ${message.id}`);
```

**Parameters:**
```typescript
{
  user_id?: string | null;           // User's profile ID
  whatsapp_message_id?: string;      // Twilio message ID
  direction: 'inbound' | 'outbound'; // Message direction
  message_body?: string | null;      // Message text
  media_url?: string | null;         // Attached media URL
  intent?: string | null;            // Detected intent
  processed?: boolean;               // Processing status
  ai_used?: boolean;                 // Whether AI was used
  error_message?: string | null;     // Error if processing failed
}
```

**Returns:**
```typescript
{
  data: any | null,  // Inserted record with ID
  error: Error | null
}
```

**Notes:**
- Automatically sets `received_at` timestamp
- Used for audit trail and debugging

---

### 4. `updateWhatsAppMessageStatus(messageId: string, processed: boolean, errorMessage?: string)`

Update message processing status.

```typescript
// Example: Mark message as processed
await updateWhatsAppMessageStatus(messageId, true);

// Example: Mark message as failed
await updateWhatsAppMessageStatus(
  messageId,
  false,
  'Failed to parse expense data'
);
```

**Parameters:**
- `messageId` - Message ID to update
- `processed` - Whether processing succeeded
- `errorMessage` - Optional error message

---

### 5. `logAIUsage(usageData: AIUsageData)`

Log OpenAI API usage for cost tracking.

```typescript
// Example: Log GPT-4 usage after processing message
const { data, error } = await logAIUsage({
  user_id: user.id,
  intent: 'categorize_expense',
  prompt_tokens: 150,
  completion_tokens: 50,
  total_tokens: 200,
  model: 'gpt-4-turbo-preview',
  estimated_cost_usd: 0.002,
});

if (error) {
  console.error('Failed to log AI usage:', error);
}
```

**Parameters:**
```typescript
{
  user_id?: string | null;      // User's profile ID
  intent?: string | null;        // What the AI was used for
  prompt_tokens: number;         // Input tokens
  completion_tokens: number;     // Output tokens
  total_tokens: number;          // Total tokens
  model: string;                 // Model used (e.g., 'gpt-4')
  estimated_cost_usd: number;    // Estimated cost in USD
}
```

**Cost Calculation Example:**
```typescript
// GPT-4 Turbo pricing (as of 2024)
const COST_PER_1K_PROMPT = 0.01;  // $0.01 per 1K prompt tokens
const COST_PER_1K_COMPLETION = 0.03; // $0.03 per 1K completion tokens

const estimatedCost = 
  (promptTokens / 1000) * COST_PER_1K_PROMPT +
  (completionTokens / 1000) * COST_PER_1K_COMPLETION;
```

---

### 6. `createUserProfile(whatsappNumber: string, fullName?: string)`

Create a new user profile.

```typescript
// Example: Create profile for new WhatsApp user
const { data: profile, error } = await createUserProfile(
  '+256771234567',
  'John Doe'
);

if (error) {
  console.error('Failed to create profile:', error);
  return;
}

console.log(`Profile created: ${profile.id}`);
```

**Parameters:**
- `whatsappNumber` - WhatsApp number
- `fullName` - Optional full name (defaults to "User 1234")

**Returns:**
```typescript
{
  data: Profile | null,
  error: Error | null
}
```

**Notes:**
- Automatically sets defaults: `currency: 'UGX'`, `language: 'en'`
- Triggered by first WhatsApp message from unknown number
- Database trigger auto-creates default project + 5 categories

---

### 7. `updateUserLastActive(userId: string)`

Update user's last active timestamp.

```typescript
// Example: Track user activity
await updateUserLastActive(user.id);
```

**Parameters:**
- `userId` - User's profile ID

**Use Cases:**
- Track when users last interacted via WhatsApp
- Show "last seen" in dashboard
- Identify inactive users

---

### 8. `getUserExpenseCategories(userId: string)`

Get user's expense categories.

```typescript
// Example: Get categories for dropdown
const { data: categories, error } = await getUserExpenseCategories(userId);

if (error) {
  console.error('Failed to get categories:', error);
  return;
}

console.log(`Found ${categories.length} categories`);
// Categories: Materials, Labor, Equipment, Transport, Other
```

**Returns:**
```typescript
{
  data: Array<{
    id: string;
    user_id: string;
    name: string;
    color_hex: string;
    created_at: string;
    deleted_at: string | null;
  }> | null,
  error: Error | null
}
```

---

### 9. `getProjectSummary(projectId: string)`

Get project summary with expense totals (uses deployed SQL function).

```typescript
// Example: Get project analytics
const { data: summary, error } = await getProjectSummary(projectId);

if (error) {
  console.error('Failed to get summary:', error);
  return;
}

console.log(`Budget: ${summary.budget_amount}`);
console.log(`Total Spent: ${summary.total_spent}`);
console.log(`Remaining: ${summary.remaining}`);
```

**Returns:**
```typescript
{
  data: {
    project_id: string;
    project_name: string;
    budget_amount: number;
    total_spent: number;
    remaining: number;
    expense_count: number;
    // ... other summary fields
  } | null,
  error: Error | null
}
```

---

### 10. `testConnection()`

Test Supabase connection (health check).

```typescript
// Example: Health check endpoint
app.get('/api/health', async (req, res) => {
  const isConnected = await testConnection();
  
  res.json({
    status: isConnected ? 'healthy' : 'unhealthy',
    database: isConnected ? 'connected' : 'disconnected',
  });
});
```

**Returns:** `Promise<boolean>`

---

## 🔐 Direct Supabase Client Access

For operations not covered by helper functions:

```typescript
import { supabase } from './lib/supabase';

// Example: Custom query
const { data, error } = await supabase
  .from('expenses')
  .select('*')
  .eq('user_id', userId)
  .gte('expense_date', '2024-01-01')
  .lte('expense_date', '2024-12-31')
  .order('expense_date', { ascending: false });
```

**⚠️ Warning:**
- The `supabase` client uses **service role key** (bypasses RLS)
- Always filter by `user_id` manually for security
- Never expose this client to frontend

---

## 📋 Complete WhatsApp Handler Example

```typescript
import {
  getUserByWhatsApp,
  createUserProfile,
  getUserDefaultProject,
  logWhatsAppMessage,
  updateWhatsAppMessageStatus,
  updateUserLastActive,
} from './lib/supabase';

async function handleIncomingWhatsApp(phoneNumber: string, messageBody: string) {
  // 1. Get or create user
  let { data: user } = await getUserByWhatsApp(phoneNumber);
  
  if (!user) {
    const { data: newUser } = await createUserProfile(phoneNumber);
    user = newUser;
  }
  
  if (!user) {
    console.error('Failed to get/create user');
    return;
  }
  
  // 2. Log incoming message
  const { data: message } = await logWhatsAppMessage({
    user_id: user.id,
    direction: 'inbound',
    message_body: messageBody,
    processed: false,
  });
  
  // 3. Get default project
  const { data: project } = await getUserDefaultProject(user.id);
  
  if (!project) {
    // Send "create project first" message
    await updateWhatsAppMessageStatus(message.id, true);
    return;
  }
  
  // 4. Process the message (expense logging, etc.)
  try {
    // ... process message ...
    
    // 5. Mark as processed
    await updateWhatsAppMessageStatus(message.id, true);
    
    // 6. Update user activity
    await updateUserLastActive(user.id);
    
  } catch (error) {
    // Mark as failed
    await updateWhatsAppMessageStatus(
      message.id,
      false,
      error.message
    );
  }
}
```

---

## 🧪 Testing

```typescript
// Test connection
const isConnected = await testConnection();
console.log('Database connected:', isConnected);

// Test user lookup
const { data: user } = await getUserByWhatsApp('+256771234567');
console.log('User:', user);

// Test project lookup
if (user) {
  const { data: project } = await getUserDefaultProject(user.id);
  console.log('Default project:', project);
}
```

---

## 📊 Error Handling Pattern

All functions return `{ data, error }` format:

```typescript
const { data, error } = await someFunction();

if (error) {
  // Handle error
  console.error('Operation failed:', error.message);
  return;
}

if (!data) {
  // Handle not found (not always an error)
  console.log('Resource not found');
  return;
}

// Success - use data
console.log('Success:', data);
```

---

## 🔒 Security Notes

1. **Service Role Key**: This client bypasses Row-Level Security (RLS)
2. **Never expose to frontend**: Server-side only
3. **Always filter by user_id**: Manual security when using direct client
4. **Soft deletes**: Always check `deleted_at IS NULL`

---

**File Location:** `server/lib/supabase.ts`  
**Last Updated:** January 2026


