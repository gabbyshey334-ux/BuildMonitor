# Migration Guide: Replit (Neon) → Local Development (Supabase)

## Overview

This guide walks you through migrating the Construction Monitor application from Replit with Neon database to local development with Supabase.

## What Changed

### Database
- ✅ Migrated from **Neon PostgreSQL** to **Supabase PostgreSQL**
- ✅ Updated schema to use `uuid` instead of `varchar` for IDs
- ✅ Added timezone support to all timestamp columns
- ✅ Introduced `profiles` table that extends Supabase `auth.users`
- ✅ Added new tables: `expenses`, `expense_categories`, `images`, `ai_usage_log`
- ✅ Maintained legacy tables for backward compatibility

### Authentication
- 🔄 Currently using Express sessions (simple auth)
- 🎯 **Next Step**: Migrate to Supabase Auth

### WhatsApp Integration
- ✅ Added **Twilio WhatsApp API** integration
- ✅ Removed dependency on n8n (kept as legacy option)
- ✅ Direct webhook handling in Express

### Dependencies
- ✅ Replaced `@neondatabase/serverless` with `@supabase/supabase-js`
- ✅ Added `twilio` SDK
- ✅ Added `postgres` for Drizzle ORM
- ✅ Removed `ws` (Supabase has built-in WebSocket)

## Migration Steps

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment

1. Copy `.env.example` to `.env`
2. Add your Supabase credentials
3. Add your Twilio credentials

### Step 3: Database Setup

#### Option A: Push Schema (Recommended)

```bash
# Push schema to Supabase
npx drizzle-kit push
```

#### Option B: Generate and Run Migration

```bash
# Generate migration SQL
npx drizzle-kit generate

# Review the migration in ./migrations/
# Then push to database
npx drizzle-kit push
```

### Step 4: Seed Default Data (Optional)

Create default expense categories:

```sql
INSERT INTO expense_categories (name, description, color, icon, is_default) VALUES
  ('Materials', 'Construction materials and supplies', '#3B82F6', 'hammer', true),
  ('Labor', 'Worker wages and contractor fees', '#10B981', 'users', true),
  ('Equipment', 'Tools and machinery rental', '#F59E0B', 'wrench', true),
  ('Transport', 'Transportation and delivery', '#8B5CF6', 'truck', true),
  ('Other', 'Miscellaneous expenses', '#6B7280', 'more-horizontal', true);
```

### Step 5: Test the Application

```bash
# Start development server
npm run dev

# In another terminal, test the API
curl http://localhost:5000/api/health
```

## Schema Changes

### New Tables

#### `profiles`
Replaces the old `users` table. Links to Supabase `auth.users`:

```typescript
{
  id: uuid (PK),
  userId: uuid (FK → auth.users.id),
  whatsappNumber: string,
  fullName: string,
  phoneNumber: string,
  role: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### `expenses`
Main expense tracking (replaces scattered expense data):

```typescript
{
  id: uuid (PK),
  projectId: uuid (FK → projects.id),
  categoryId: uuid (FK → expense_categories.id),
  description: text,
  amount: decimal,
  date: timestamp,
  paymentMethod: string,
  receiptUrl: text,
  notes: text,
  createdBy: uuid (FK → profiles.id),
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### `expense_categories`
Predefined expense categories:

```typescript
{
  id: uuid (PK),
  name: string,
  description: text,
  color: string (hex),
  icon: string,
  isDefault: boolean,
  createdAt: timestamp
}
```

#### `images`
Receipt and photo storage:

```typescript
{
  id: uuid (PK),
  expenseId: uuid (FK → expenses.id),
  projectId: uuid (FK → projects.id),
  url: text (Supabase Storage URL),
  fileName: string,
  fileSize: integer,
  mimeType: string,
  uploadedBy: uuid (FK → profiles.id),
  createdAt: timestamp
}
```

#### `whatsapp_messages`
Updated to use `profileId` and `twilioMessageSid`:

```typescript
{
  id: uuid (PK),
  profileId: uuid (FK → profiles.id),
  whatsappNumber: string,
  projectId: uuid (FK → projects.id),
  direction: string ('incoming' | 'outgoing'),
  messageType: string,
  content: text,
  mediaUrl: text,
  twilioMessageSid: string (unique),
  status: string,
  metadata: jsonb,
  createdAt: timestamp
}
```

#### `ai_usage_log`
Track OpenAI API usage for cost control:

```typescript
{
  id: uuid (PK),
  profileId: uuid (FK → profiles.id),
  messageId: uuid (FK → whatsapp_messages.id),
  model: string,
  promptTokens: integer,
  completionTokens: integer,
  totalTokens: integer,
  estimatedCost: decimal,
  operation: string,
  createdAt: timestamp
}
```

### Updated Tables

All existing tables now use:
- `uuid` instead of `varchar` for IDs
- `timestamp with time zone` instead of `timestamp`
- Foreign keys reference `profiles.id` instead of `users.id`

### Legacy Tables (Maintained for Compatibility)

These tables are kept but marked as legacy:
- `advances` (consider migrating to `expenses`)
- `suppliers`
- `supplier_purchases`
- `inventory`
- `milestones`
- `daily_ledgers`
- `daily_ledger_lines`
- `cash_deposits`
- `construction_phases`
- `historical_expenses`

## API Changes

### New Endpoints

#### Twilio WhatsApp Webhook
- `POST /api/webhooks/twilio/whatsapp` - Receive WhatsApp messages
- `GET /api/webhooks/twilio/test` - Test webhook configuration

### Updated Endpoints

- All endpoints now work with the new schema
- Profile-based authentication (instead of user-based)
- UUID parameters instead of string IDs

## Breaking Changes

⚠️ **Important**: These changes may require frontend updates

1. **User ID Format**: Changed from `string` to `uuid`
2. **Project ID Format**: Changed from `string` to `uuid`
3. **Authentication**: Profile-based instead of user-based
4. **WhatsApp Messages**: New structure with Twilio integration

## Rollback Plan

If you need to rollback:

1. Keep the old Replit deployment running
2. Restore database from Neon backup
3. Revert to the previous Git commit
4. Update DNS/routing back to Replit

## Data Migration (Optional)

If you have existing data in Neon that you want to migrate:

### Export from Neon

```bash
# Using pg_dump
pg_dump $NEON_DATABASE_URL > neon_backup.sql
```

### Import to Supabase

```bash
# 1. First, create the schema in Supabase (done in Step 3)
# 2. Then import data (skip schema)
psql $SUPABASE_DATABASE_URL < neon_backup.sql
```

### Transform IDs

You'll need to transform string IDs to UUIDs. Create a migration script:

```sql
-- Example: Transform user IDs to profiles
INSERT INTO profiles (id, whatsapp_number, full_name)
SELECT 
  gen_random_uuid(),
  whatsapp_number,
  COALESCE(first_name || ' ' || last_name, 'Unknown')
FROM old_users;

-- Map old IDs to new UUIDs
CREATE TEMP TABLE id_mapping (
  old_id varchar,
  new_id uuid
);

-- Continue mapping for projects, tasks, etc.
```

## Testing Checklist

- [ ] Database connection works
- [ ] Health check endpoint returns success
- [ ] Can create a project
- [ ] Can create a task
- [ ] Can log an expense
- [ ] WhatsApp webhook receives messages
- [ ] WhatsApp replies are sent
- [ ] File uploads work
- [ ] Dashboard loads correctly
- [ ] Reports generate correctly

## Next Steps

### Immediate
1. ✅ Complete database migration
2. ✅ Test WhatsApp integration
3. ✅ Update frontend to use new API

### Short-term
1. 🔄 Implement Supabase Auth
2. 🔄 Migrate to expense tracking (phase out legacy tables)
3. 🔄 Set up Supabase Storage for images

### Long-term
1. 🎯 Add AI-powered expense categorization
2. 🎯 Implement real-time notifications
3. 🎯 Build mobile app using Supabase

## Support

If you encounter issues:

1. Check logs: `npm run dev` (watch console output)
2. Verify environment variables: `.env` file
3. Test database: `npx drizzle-kit push --verbose`
4. Test Twilio: Check Twilio console logs

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)


