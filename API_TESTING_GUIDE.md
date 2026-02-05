# API Testing Guide - Complete Endpoint List

## 🎯 Test All API Endpoints

This guide lists all available API endpoints with test commands and expected responses.

**Base URL:** `https://build-monitor-lac.vercel.app`

---

## 📊 **1. Connection & Health Tests**

### ✅ Test Supabase Connection
```bash
curl https://build-monitor-lac.vercel.app/api/test/supabase
```

**Expected Response:**
```json
{
  "status": "ok",
  "connection": "successful",
  "supabase": { "url": "...", "hasKey": true },
  "data": {
    "profiles": { "count": 0, "error": null },
    "projects": { "count": 0, "error": null },
    "expenses": { "count": 0, "error": null },
    "tasks": { "count": 0, "error": null }
  },
  "drizzle": { "connected": true, "method": "direct_connection" }
}
```

### ✅ Health Check
```bash
curl https://build-monitor-lac.vercel.app/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-02-04T...",
  "environment": "production"
}
```

### ✅ Database Debug
```bash
curl https://build-monitor-lac.vercel.app/api/debug/db
```

**Expected Response:**
```json
{
  "status": "ok",
  "database": { "url": "configured" }
}
```

### ✅ Session Debug
```bash
curl https://build-monitor-lac.vercel.app/api/debug/session
```

**Expected Response:**
```json
{
  "session": { "userId": null, "authenticated": false }
}
```

---

## 🔐 **2. Authentication Endpoints**

### ✅ Check Current User (No Auth Required)
```bash
curl https://build-monitor-lac.vercel.app/api/auth/me \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID"
```

**Expected Response (Not Logged In):**
```json
{
  "success": false,
  "error": "Authentication required"
}
```

**Expected Response (Logged In):**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "whatsappNumber": "+256...",
    "fullName": "User Name",
    "defaultCurrency": "UGX"
  }
}
```

### ✅ Register New User
```bash
curl -X POST https://build-monitor-lac.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "password": "TestPassword123!",
    "whatsappNumber": "+256700000001"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "test@example.com",
    "whatsappNumber": "+256700000001"
  },
  "message": "Registration successful"
}
```

### ✅ Login
```bash
curl -X POST https://build-monitor-lac.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }' \
  -c cookies.txt
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "test@example.com",
    "whatsappNumber": "+256700000001"
  },
  "message": "Login successful"
}
```

**Note:** Save the session cookie from `cookies.txt` for authenticated requests.

### ✅ Logout
```bash
curl -X POST https://build-monitor-lac.vercel.app/api/auth/logout \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### ✅ Check Auth Status
```bash
curl https://build-monitor-lac.vercel.app/api/auth/check \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID"
```

**Expected Response:**
```json
{
  "authenticated": true,
  "userId": "user-uuid"
}
```

---

## 📁 **3. Project Endpoints** (Requires Authentication)

### ✅ Get All Projects
```bash
curl https://build-monitor-lac.vercel.app/api/projects \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID"
```

**Expected Response:**
```json
{
  "success": true,
  "projects": [
    {
      "id": "project-uuid",
      "name": "My Construction Project",
      "description": "Project description",
      "budgetAmount": "10000000",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### ✅ Create Project
```bash
curl -X POST https://build-monitor-lac.vercel.app/api/projects \
  -H "Content-Type: application/json" \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID" \
  -d '{
    "name": "New Construction Project",
    "description": "Building a house",
    "budgetAmount": "5000000",
    "status": "active"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "project": {
    "id": "project-uuid",
    "name": "New Construction Project",
    "budgetAmount": "5000000",
    "status": "active"
  }
}
```

---

## 💰 **4. Dashboard Endpoints** (Requires Authentication)

### ✅ Get Dashboard Summary
```bash
curl https://build-monitor-lac.vercel.app/api/dashboard/summary \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID"
```

**Expected Response:**
```json
{
  "success": true,
  "summary": {
    "budget": 10000000,
    "totalSpent": 4800000,
    "remaining": 5200000,
    "percentUsed": 48,
    "expenseCount": 8,
    "taskCount": 6,
    "projectName": "My Construction Project",
    "projectId": "project-uuid"
  }
}
```

---

## 💵 **5. Expense Endpoints** (Requires Authentication)

### ✅ Get Expenses
```bash
curl "https://build-monitor-lac.vercel.app/api/expenses?limit=20&offset=0" \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID"
```

**Expected Response:**
```json
{
  "success": true,
  "expenses": [
    {
      "id": "expense-uuid",
      "description": "Cement bags",
      "amount": "500000",
      "categoryName": "Materials",
      "categoryColor": "#93C54E",
      "expenseDate": "2024-01-15T00:00:00.000Z",
      "source": "whatsapp"
    }
  ],
  "pagination": {
    "total": 8,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

### ✅ Create Expense
```bash
curl -X POST https://build-monitor-lac.vercel.app/api/expenses \
  -H "Content-Type: application/json" \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID" \
  -d '{
    "description": "Bricks (1000 pieces)",
    "amount": "200000",
    "categoryId": "category-uuid",
    "expenseDate": "2024-02-04"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "expense": {
    "id": "expense-uuid",
    "description": "Bricks (1000 pieces)",
    "amount": "200000",
    "expenseDate": "2024-02-04T00:00:00.000Z"
  }
}
```

### ✅ Update Expense
```bash
curl -X PUT https://build-monitor-lac.vercel.app/api/expenses/EXPENSE_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID" \
  -d '{
    "description": "Updated description",
    "amount": "250000"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "expense": {
    "id": "expense-uuid",
    "description": "Updated description",
    "amount": "250000"
  }
}
```

### ✅ Delete Expense
```bash
curl -X DELETE https://build-monitor-lac.vercel.app/api/expenses/EXPENSE_ID \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Expense deleted successfully"
}
```

---

## ✅ **6. Task Endpoints** (Requires Authentication)

### ✅ Get Tasks
```bash
curl "https://build-monitor-lac.vercel.app/api/tasks?status=pending,in_progress,completed&limit=50" \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID"
```

**Expected Response:**
```json
{
  "success": true,
  "tasks": [
    {
      "id": "task-uuid",
      "title": "Inspect foundation",
      "description": "Check concrete curing",
      "status": "pending",
      "priority": "high",
      "dueDate": "2024-02-10T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 6,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### ✅ Create Task
```bash
curl -X POST https://build-monitor-lac.vercel.app/api/tasks \
  -H "Content-Type: application/json" \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID" \
  -d '{
    "title": "Pour foundation",
    "description": "Schedule concrete delivery",
    "priority": "high",
    "dueDate": "2024-02-15"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "task": {
    "id": "task-uuid",
    "title": "Pour foundation",
    "status": "pending",
    "priority": "high"
  }
}
```

### ✅ Update Task
```bash
curl -X PUT https://build-monitor-lac.vercel.app/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID" \
  -d '{
    "status": "in_progress",
    "priority": "medium"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "task": {
    "id": "task-uuid",
    "status": "in_progress",
    "priority": "medium"
  }
}
```

### ✅ Delete Task
```bash
curl -X DELETE https://build-monitor-lac.vercel.app/api/tasks/TASK_ID \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Task deleted successfully"
}
```

---

## 🏷️ **7. Category Endpoints** (Requires Authentication)

### ✅ Get Categories
```bash
curl https://build-monitor-lac.vercel.app/api/categories \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID"
```

**Expected Response:**
```json
{
  "success": true,
  "categories": [
    {
      "id": "category-uuid",
      "name": "Materials",
      "colorHex": "#93C54E"
    },
    {
      "id": "category-uuid",
      "name": "Labor",
      "colorHex": "#218598"
    }
  ]
}
```

---

## 📸 **8. Image Endpoints** (Requires Authentication)

### ✅ Get Images
```bash
curl "https://build-monitor-lac.vercel.app/api/images?projectId=PROJECT_ID" \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID"
```

**Expected Response:**
```json
{
  "success": true,
  "images": [
    {
      "id": "image-uuid",
      "fileName": "photo.jpg",
      "storagePath": "projects/.../photo.jpg",
      "createdAt": "2024-01-15T00:00:00.000Z"
    }
  ]
}
```

### ✅ Upload Image
```bash
curl -X POST https://build-monitor-lac.vercel.app/api/images \
  -H "Cookie: jengatrack.sid=YOUR_SESSION_ID" \
  -F "file=@/path/to/image.jpg" \
  -F "projectId=PROJECT_ID" \
  -F "caption=Construction progress"
```

**Expected Response:**
```json
{
  "success": true,
  "image": {
    "id": "image-uuid",
    "fileName": "image.jpg",
    "storagePath": "projects/.../image.jpg"
  }
}
```

---

## 💬 **9. WhatsApp Webhook** (No Auth Required)

### ✅ WhatsApp Webhook
```bash
curl -X POST https://build-monitor-lac.vercel.app/webhook/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+256770000001&Body=spent 500000 on cement"
```

**Expected Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>✅ Logged: 500,000 UGX for cement</Message>
</Response>
```

### ✅ WhatsApp Debug Logs
```bash
curl "https://build-monitor-lac.vercel.app/webhook/debug?limit=50"
```

**Expected Response:**
```json
{
  "success": true,
  "total": 10,
  "logs": [
    {
      "timestamp": "2024-02-04T...",
      "phoneNumber": "+256770000001",
      "direction": "inbound",
      "messageBody": "spent 500000 on cement",
      "intent": "log_expense",
      "success": true
    }
  ]
}
```

---

## 🧪 **Testing Checklist**

### Phase 1: Connection Tests
- [ ] `/api/test/supabase` - Verify Supabase & Drizzle connection
- [ ] `/health` - Verify server is running
- [ ] `/api/debug/db` - Verify database connection
- [ ] `/api/debug/session` - Check session status

### Phase 2: Authentication Tests
- [ ] `POST /api/auth/register` - Create new user
- [ ] `POST /api/auth/login` - Login and get session cookie
- [ ] `GET /api/auth/me` - Verify authentication
- [ ] `GET /api/auth/check` - Check auth status
- [ ] `POST /api/auth/logout` - Logout

### Phase 3: Project Tests
- [ ] `GET /api/projects` - List projects (should be empty initially)
- [ ] `POST /api/projects` - Create project
- [ ] `GET /api/projects` - Verify project appears

### Phase 4: Dashboard Tests
- [ ] `GET /api/dashboard/summary` - Get dashboard data (may show "No active project")

### Phase 5: Expense Tests
- [ ] `GET /api/expenses` - List expenses
- [ ] `POST /api/expenses` - Create expense
- [ ] `GET /api/expenses` - Verify expense appears
- [ ] `PUT /api/expenses/:id` - Update expense
- [ ] `DELETE /api/expenses/:id` - Delete expense

### Phase 6: Task Tests
- [ ] `GET /api/tasks` - List tasks
- [ ] `POST /api/tasks` - Create task
- [ ] `GET /api/tasks` - Verify task appears
- [ ] `PUT /api/tasks/:id` - Update task
- [ ] `DELETE /api/tasks/:id` - Delete task

### Phase 7: Category Tests
- [ ] `GET /api/categories` - List categories

### Phase 8: WhatsApp Tests
- [ ] `POST /webhook/webhook` - Send test message
- [ ] `GET /webhook/debug` - Check WhatsApp logs

---

## 🔧 **Quick Test Script**

Save this as `test-all-apis.sh`:

```bash
#!/bin/bash

BASE_URL="https://build-monitor-lac.vercel.app"
SESSION_COOKIE="" # Set after login

echo "🧪 Testing API Endpoints..."
echo ""

# 1. Connection Tests
echo "1️⃣ Connection Tests"
curl -s "$BASE_URL/api/test/supabase" | jq '.status, .drizzle.connected'
curl -s "$BASE_URL/health" | jq '.status'
echo ""

# 2. Auth Tests
echo "2️⃣ Authentication Tests"
# Register
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test User","email":"test@example.com","password":"Test123!","whatsappNumber":"+256700000001"}')
echo "Register: $(echo $REGISTER_RESPONSE | jq -r '.success')"

# Login and save cookie
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}')
echo "Login: $(echo $LOGIN_RESPONSE | jq -r '.success')"

# Get session cookie
SESSION_COOKIE=$(grep jengatrack cookies.txt | awk '{print $7}')

# Check auth
curl -s "$BASE_URL/api/auth/me" -H "Cookie: jengatrack.sid=$SESSION_COOKIE" | jq '.success'
echo ""

# 3. Dashboard Tests
echo "3️⃣ Dashboard Tests"
curl -s "$BASE_URL/api/dashboard/summary" \
  -H "Cookie: jengatrack.sid=$SESSION_COOKIE" | jq '.success, .summary.budget'
echo ""

echo "✅ Testing complete!"
```

---

## 📝 **Notes**

1. **Session Cookie**: Most endpoints require authentication. Save the cookie from login and use it in subsequent requests.

2. **Error Responses**: All endpoints return errors in this format:
   ```json
   {
     "success": false,
     "error": "Error message"
   }
   ```

3. **401 Unauthorized**: If you get 401, you need to login first and include the session cookie.

4. **Empty Data**: If tables are empty, use the seed script first: `npm run seed:test`

5. **Base URL**: Replace `build-monitor-lac.vercel.app` with your actual Vercel URL if different.

---

## 🎯 **Priority Testing Order**

1. **Critical**: `/api/test/supabase`, `/health`
2. **Essential**: `/api/auth/login`, `/api/auth/me`
3. **Core Features**: `/api/dashboard/summary`, `/api/expenses`, `/api/tasks`
4. **Secondary**: `/api/projects`, `/api/categories`, `/api/images`
5. **Integration**: `/webhook/webhook` (WhatsApp)

Test these in order to verify the full system is working!

