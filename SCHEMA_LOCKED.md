# ⚠️ CRITICAL: Database Schema - DO NOT MODIFY

## 🔒 Schema Status: DEPLOYED & LOCKED

This database schema is **ALREADY DEPLOYED** and **RUNNING IN PRODUCTION** on Supabase.

**DO NOT:**
- ❌ Add new columns
- ❌ Modify column names
- ❌ Change data types
- ❌ Alter constraints
- ❌ Run migrations that change structure

**DO:**
- ✅ Query the existing tables
- ✅ Insert/update/delete data
- ✅ Use the exact column names as defined
- ✅ Work with the deployed schema

---

## 📋 Deployed Schema (Exact Structure)

### 1. profiles (extends Supabase auth.users)
```sql
- id UUID PRIMARY KEY (IS auth.users.id, not a reference)
- whatsapp_number VARCHAR(20) UNIQUE NOT NULL
- full_name VARCHAR(255) NOT NULL
- default_currency VARCHAR(3) DEFAULT 'UGX'
- preferred_language VARCHAR(10) DEFAULT 'en'
- created_at TIMESTAMPTZ DEFAULT now()
- updated_at TIMESTAMPTZ DEFAULT now()
- last_active_at TIMESTAMPTZ
- deleted_at TIMESTAMPTZ (soft delete)
```

### 2. projects
```sql
- id UUID PRIMARY KEY
- user_id UUID REFERENCES profiles(id)
- name VARCHAR(255) NOT NULL
- description TEXT
- budget_amount DECIMAL(15, 2)
- status VARCHAR(20) DEFAULT 'active' ('active', 'completed', 'paused')
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
- completed_at TIMESTAMPTZ
- deleted_at TIMESTAMPTZ (soft delete)
```

### 3. expense_categories
```sql
- id UUID PRIMARY KEY
- user_id UUID REFERENCES profiles(id)
- name VARCHAR(100) NOT NULL
- color_hex VARCHAR(7)
- created_at TIMESTAMPTZ
- deleted_at TIMESTAMPTZ (soft delete)
- UNIQUE CONSTRAINT (user_id, name)
```

### 4. expenses
```sql
- id UUID PRIMARY KEY
- user_id UUID REFERENCES profiles(id)
- project_id UUID REFERENCES projects(id)
- category_id UUID REFERENCES expense_categories(id) NULL
- description TEXT NOT NULL
- amount DECIMAL(15, 2) NOT NULL
- currency VARCHAR(3) DEFAULT 'UGX'
- source VARCHAR(20) ('whatsapp', 'dashboard', 'api')
- expense_date DATE NOT NULL
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
- deleted_at TIMESTAMPTZ (soft delete)
```

### 5. tasks
```sql
- id UUID PRIMARY KEY
- user_id UUID REFERENCES profiles(id)
- project_id UUID REFERENCES projects(id)
- title VARCHAR(255) NOT NULL
- description TEXT
- status VARCHAR(20) DEFAULT 'pending' ('pending', 'in_progress', 'completed', 'cancelled')
- priority VARCHAR(10) DEFAULT 'medium' ('low', 'medium', 'high')
- due_date DATE
- completed_at TIMESTAMPTZ
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
- deleted_at TIMESTAMPTZ (soft delete)
```

### 6. images
```sql
- id UUID PRIMARY KEY
- user_id UUID REFERENCES profiles(id)
- project_id UUID REFERENCES projects(id) NULL
- expense_id UUID REFERENCES expenses(id) NULL
- storage_path TEXT NOT NULL
- file_name VARCHAR(255) NOT NULL
- file_size_bytes INTEGER
- mime_type VARCHAR(100)
- caption TEXT
- source VARCHAR(20) ('whatsapp', 'dashboard')
- created_at TIMESTAMPTZ
- deleted_at TIMESTAMPTZ (soft delete)
```

### 7. whatsapp_messages (audit log)
```sql
- id UUID PRIMARY KEY
- user_id UUID REFERENCES profiles(id) NULL
- whatsapp_message_id VARCHAR(255)
- direction VARCHAR(10) ('inbound', 'outbound')
- message_body TEXT
- media_url TEXT
- intent VARCHAR(50)
- processed BOOLEAN DEFAULT FALSE
- ai_used BOOLEAN DEFAULT FALSE
- error_message TEXT
- received_at TIMESTAMPTZ
- processed_at TIMESTAMPTZ
```

### 8. ai_usage_log (cost tracking)
```sql
- id UUID PRIMARY KEY
- user_id UUID REFERENCES profiles(id) NULL
- intent VARCHAR(50)
- prompt_tokens INTEGER
- completion_tokens INTEGER
- total_tokens INTEGER
- model VARCHAR(50)
- estimated_cost_usd DECIMAL(10, 6)
- created_at TIMESTAMPTZ
```

---

## 🔐 Security Features (Already Enabled)

### Row-Level Security (RLS)
- ✅ Enabled on ALL tables
- ✅ Users can only access their own data (filtered by `user_id`)
- ✅ Automatic filtering in all queries

### Triggers
- ✅ Auto-create default project on user signup
- ✅ Auto-create 5 default expense categories on signup
- ✅ Auto-update `updated_at` timestamp on changes

### Helper Functions
- ✅ `get_user_by_whatsapp(phone)` - Find user by WhatsApp number
- ✅ `get_project_summary(proj_id)` - Get project analytics

---

## 📝 Column Naming Convention

**Database uses snake_case:**
- `user_id`, `project_id`, `expense_date`
- `whatsapp_number`, `full_name`
- `budget_amount`, `color_hex`

**Code uses camelCase (Drizzle auto-converts):**
- `userId`, `projectId`, `expenseDate`
- `whatsappNumber`, `fullName`
- `budgetAmount`, `colorHex`

**When writing SQL:** Use snake_case
**When using Drizzle ORM:** Use camelCase

---

## 🗑️ Soft Deletes

All tables use **soft deletes** with `deleted_at` column:

```typescript
// Don't do this
await db.delete(expenses).where(eq(expenses.id, id));

// Do this instead
await db.update(expenses)
  .set({ deletedAt: new Date() })
  .where(eq(expenses.id, id));
```

**Query non-deleted records:**
```typescript
const activeExpenses = await db
  .select()
  .from(expenses)
  .where(and(
    eq(expenses.userId, userId),
    sql`${expenses.deletedAt} IS NULL`
  ));
```

---

## 🚫 What NOT to Do

### ❌ DON'T Add Columns
```typescript
// WRONG - Will break production
export const expenses = pgTable("expenses", {
  // ... existing columns
  receiptUrl: text("receipt_url"), // ❌ New column
});
```

### ❌ DON'T Rename Columns
```typescript
// WRONG
budgetAmount: decimal("budget"), // ❌ Wrong column name
```

### ❌ DON'T Change Types
```typescript
// WRONG
amount: integer("amount"), // ❌ Should be decimal(15,2)
```

### ❌ DON'T Run Migrations
```bash
# WRONG - Will try to alter deployed schema
npm run db:push
```

---

## ✅ What TO Do

### ✅ Query Existing Data
```typescript
const expenses = await db
  .select()
  .from(expenses)
  .where(eq(expenses.userId, userId));
```

### ✅ Insert New Records
```typescript
await db.insert(expenses).values({
  userId,
  projectId,
  description: "Cement",
  amount: "50000",
  expenseDate: new Date(),
});
```

### ✅ Use Correct Column Names
```typescript
// Correct - matches deployed schema
await db.update(projects)
  .set({ budgetAmount: "1000000" }) // ✅ budget_amount
  .where(eq(projects.id, projectId));
```

---

## 🔄 Schema Sync Status

**Local Code:** ✅ Updated to match deployed schema  
**Supabase Database:** ✅ Production schema (locked)  
**Match Status:** ✅ **EXACT MATCH**

The `shared/schema.ts` file now reflects the EXACT structure deployed in Supabase.

---

## 📖 For Developers

When working with this codebase:

1. **Never modify `shared/schema.ts` structure**
   - Only add validation rules if needed
   - Don't change table definitions

2. **Use Drizzle ORM for queries**
   - Auto-handles snake_case ↔ camelCase conversion
   - Type-safe queries
   - RLS automatically applied

3. **Test locally with Supabase connection**
   - Connect to the real Supabase database
   - Don't create local test schemas

4. **If schema changes are needed:**
   - Discuss with team
   - Update Supabase first
   - Then update code

---

**Last Verified:** January 2026  
**Schema Version:** Production v1.0  
**Status:** 🔒 LOCKED - DO NOT MODIFY


