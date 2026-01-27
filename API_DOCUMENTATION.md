# Backend API Documentation

## Overview

RESTful API for BuildMonitor dashboard. All endpoints use JSON for request/response bodies.

**Base URL**: `http://localhost:5000/api`

## Authentication

The API uses session-based authentication with `express-session` stored in PostgreSQL.

### Session Cookie
- **Name**: `buildmonitor.sid`
- **HttpOnly**: `true`
- **Secure**: `true` (production only)
- **SameSite**: `strict` (production), `lax` (development)
- **Max Age**: 7 days

### Authentication Flow

1. **Login** → Server creates session and returns user profile
2. **Subsequent requests** → Session cookie automatically included
3. **Logout** → Server destroys session

## Endpoints

### 🔐 Authentication

#### POST /api/auth/login
Login with credentials and create session.

**Request Body:**
```json
{
  "username": "owner",
  "password": "owner123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "whatsappNumber": "+256770123456",
    "fullName": "John Doe",
    "defaultCurrency": "UGX",
    "preferredLanguage": "en"
  }
}
```

**Errors:**
- `401 Unauthorized`: Invalid credentials
- `404 Not Found`: User profile not found

---

#### POST /api/auth/logout
Logout and destroy session.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### GET /api/auth/me
Get current authenticated user profile.

**Requires Authentication**: ✅

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "whatsappNumber": "+256770123456",
    "fullName": "John Doe",
    "defaultCurrency": "UGX",
    "preferredLanguage": "en",
    "createdAt": "2025-01-01T00:00:00Z",
    "lastActiveAt": "2025-01-25T10:00:00Z"
  }
}
```

**Errors:**
- `401 Unauthorized`: Not logged in

---

### 📊 Dashboard

#### GET /api/dashboard/summary
Get dashboard summary with budget, expenses, and tasks.

**Requires Authentication**: ✅

**Response (200 OK):**
```json
{
  "success": true,
  "summary": {
    "budget": 1000000,
    "totalSpent": 5500,
    "remaining": 994500,
    "percentUsed": 0.6,
    "expenseCount": 3,
    "taskCount": 2,
    "projectName": "House Construction",
    "projectId": "uuid"
  }
}
```

**Notes:**
- Returns zero metrics if no active project
- `taskCount` only includes pending/in_progress tasks
- `percentUsed` is rounded to 1 decimal place

---

### 💰 Expenses

#### GET /api/expenses
Get expenses with optional filtering and pagination.

**Requires Authentication**: ✅

**Query Parameters:**
- `limit` (number, default: 20): Number of results per page
- `offset` (number, default: 0): Pagination offset
- `category_id` (uuid, optional): Filter by category
- `from_date` (YYYY-MM-DD, optional): Filter expenses from date
- `to_date` (YYYY-MM-DD, optional): Filter expenses until date

**Example Request:**
```
GET /api/expenses?limit=10&offset=0&category_id=uuid&from_date=2025-01-01
```

**Response (200 OK):**
```json
{
  "success": true,
  "expenses": [
    {
      "id": "uuid",
      "userId": "uuid",
      "projectId": "uuid",
      "categoryId": "uuid",
      "description": "Cement bags",
      "amount": "500",
      "currency": "UGX",
      "source": "whatsapp",
      "expenseDate": "2025-01-25T00:00:00Z",
      "createdAt": "2025-01-25T10:00:00Z",
      "updatedAt": "2025-01-25T10:00:00Z",
      "categoryName": "Materials",
      "categoryColor": "#FF6347"
    }
  ],
  "pagination": {
    "total": 3,
    "limit": 10,
    "offset": 0,
    "hasMore": false
  }
}
```

---

#### POST /api/expenses
Create a new expense.

**Requires Authentication**: ✅

**Request Body:**
```json
{
  "description": "Cement bags for foundation",
  "amount": 500,
  "categoryId": "uuid",
  "expenseDate": "2025-01-25"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Expense created successfully",
  "expense": {
    "id": "uuid",
    "userId": "uuid",
    "projectId": "uuid",
    "categoryId": "uuid",
    "description": "Cement bags for foundation",
    "amount": "500",
    "currency": "UGX",
    "source": "dashboard",
    "expenseDate": "2025-01-25T00:00:00Z",
    "createdAt": "2025-01-25T10:00:00Z",
    "updatedAt": "2025-01-25T10:00:00Z",
    "categoryName": "Materials",
    "categoryColor": "#FF6347"
  }
}
```

**Validation:**
- `description`: Required, max 500 characters
- `amount`: Required, must be positive number
- `categoryId`: Optional, must be valid UUID
- `expenseDate`: Required, valid date string

**Errors:**
- `400 Bad Request`: Validation error or no active project
- `401 Unauthorized`: Not logged in

---

#### PUT /api/expenses/:id
Update an existing expense.

**Requires Authentication**: ✅

**Request Body (all fields optional):**
```json
{
  "description": "Updated description",
  "amount": 600,
  "categoryId": "uuid",
  "expenseDate": "2025-01-25"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Expense updated successfully",
  "expense": { /* updated expense object */ }
}
```

**Errors:**
- `404 Not Found`: Expense doesn't exist or not owned by user
- `400 Bad Request`: Validation error

---

#### DELETE /api/expenses/:id
Soft delete an expense (sets `deleted_at` timestamp).

**Requires Authentication**: ✅

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Expense deleted successfully"
}
```

**Errors:**
- `404 Not Found`: Expense doesn't exist or not owned by user

---

### ✅ Tasks

#### GET /api/tasks
Get tasks with optional filtering and pagination.

**Requires Authentication**: ✅

**Query Parameters:**
- `limit` (number, default: 50): Number of results per page
- `offset` (number, default: 0): Pagination offset
- `status` (string, optional): Filter by status (pending, in_progress, completed, cancelled)

**Response (200 OK):**
```json
{
  "success": true,
  "tasks": [
    {
      "id": "uuid",
      "userId": "uuid",
      "projectId": "uuid",
      "title": "Inspect foundation",
      "description": "Check for cracks",
      "status": "pending",
      "priority": "high",
      "dueDate": "2025-01-30T00:00:00Z",
      "completedAt": null,
      "createdAt": "2025-01-25T10:00:00Z",
      "updatedAt": "2025-01-25T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

---

#### POST /api/tasks
Create a new task.

**Requires Authentication**: ✅

**Request Body:**
```json
{
  "title": "Inspect foundation",
  "description": "Check for any cracks or issues",
  "dueDate": "2025-01-30",
  "priority": "high"
}
```

**Fields:**
- `title` (string, required): Max 255 characters
- `description` (string, optional): Max 1000 characters
- `dueDate` (date string, optional): Due date
- `priority` (enum, default: "medium"): "low", "medium", or "high"

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Task created successfully",
  "task": { /* created task object */ }
}
```

**Errors:**
- `400 Bad Request`: Validation error or no active project

---

#### PUT /api/tasks/:id
Update a task.

**Requires Authentication**: ✅

**Request Body (all fields optional):**
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "dueDate": "2025-01-30",
  "priority": "high",
  "status": "completed"
}
```

**Status Values:**
- `pending`: Not started
- `in_progress`: Currently working on
- `completed`: Finished (sets `completedAt` timestamp)
- `cancelled`: Cancelled

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Task updated successfully",
  "task": { /* updated task object */ }
}
```

**Errors:**
- `404 Not Found`: Task doesn't exist or not owned by user

---

#### DELETE /api/tasks/:id
Soft delete a task.

**Requires Authentication**: ✅

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Task deleted successfully"
}
```

---

### 🏷️ Categories

#### GET /api/categories
Get user's expense categories.

**Requires Authentication**: ✅

**Response (200 OK):**
```json
{
  "success": true,
  "categories": [
    {
      "id": "uuid",
      "userId": "uuid",
      "name": "Materials",
      "colorHex": "#FF6347",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "userId": "uuid",
      "name": "Labor",
      "colorHex": "#4682B4",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

**Default Categories:**
1. Materials (#FF6347)
2. Labor (#4682B4)
3. Equipment (#32CD32)
4. Transport (#FFD700)
5. Miscellaneous (#8A2BE2)

---

### 📸 Images

#### GET /api/images
Get user's images with optional filtering.

**Requires Authentication**: ✅

**Query Parameters:**
- `limit` (number, default: 20): Number of results
- `offset` (number, default: 0): Pagination offset
- `expense_id` (uuid, optional): Filter by expense

**Response (200 OK):**
```json
{
  "success": true,
  "images": [
    {
      "id": "uuid",
      "userId": "uuid",
      "projectId": "uuid",
      "expenseId": "uuid",
      "storagePath": "https://...",
      "fileName": "receipt.jpg",
      "fileSizeBytes": 1024000,
      "mimeType": "image/jpeg",
      "caption": "Receipt for cement",
      "source": "whatsapp",
      "createdAt": "2025-01-25T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

---

#### POST /api/images
Upload an image (simplified for MVP).

**Requires Authentication**: ✅

**Request Body:**
```json
{
  "imageUrl": "https://storage.supabase.co/...",
  "projectId": "uuid",
  "expenseId": "uuid",
  "caption": "Receipt for materials"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "image": { /* image object */ }
}
```

**Note**: Currently accepts image URL. Full file upload implementation (multipart/form-data) coming soon.

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message",
  "details": [ /* optional validation errors */ ]
}
```

### Common Error Codes

- **400 Bad Request**: Validation error or missing required data
- **401 Unauthorized**: Not authenticated or invalid credentials
- **404 Not Found**: Resource not found or access denied
- **500 Internal Server Error**: Server error

## Rate Limiting

Currently no rate limiting implemented. Consider adding for production:
- Login attempts: 5 per 15 minutes
- API requests: 100 per minute

## CORS

CORS is handled by the server. Frontend running on same domain doesn't need special configuration.

## Testing

### Using curl

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"owner","password":"owner123"}' \
  -c cookies.txt
```

**Get Dashboard:**
```bash
curl -X GET http://localhost:5000/api/dashboard/summary \
  -b cookies.txt
```

**Create Expense:**
```bash
curl -X POST http://localhost:5000/api/expenses \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "description": "Cement bags",
    "amount": 500,
    "expenseDate": "2025-01-25"
  }'
```

### Using JavaScript (Frontend)

```javascript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'owner',
    password: 'owner123'
  }),
  credentials: 'include' // Important for cookies
});

const { user } = await response.json();

// Get expenses
const expensesResponse = await fetch('/api/expenses?limit=10', {
  credentials: 'include'
});

const { expenses } = await expensesResponse.json();

// Create expense
const createResponse = await fetch('/api/expenses', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    description: 'Cement bags',
    amount: 500,
    expenseDate: '2025-01-25'
  }),
  credentials: 'include'
});
```

## Database Schema

See `shared/schema.ts` for complete database schema definitions.

**Key Tables:**
- `profiles`: User accounts
- `projects`: Construction projects
- `expenses`: Expense records
- `tasks`: Task management
- `expense_categories`: Expense categories
- `images`: Image metadata
- `sessions`: Session storage (PostgreSQL)

## Security Considerations

### Production Checklist
- ✅ Use HTTPS (secure cookies)
- ✅ Set strong SESSION_SECRET
- ✅ Enable PostgreSQL SSL
- ✅ Use Supabase Row-Level Security (RLS)
- ✅ Validate all inputs with Zod
- ✅ Implement rate limiting
- ✅ Set CORS whitelist
- ✅ Enable CSRF protection
- ⚠️ Replace hardcoded credentials with proper auth
- ⚠️ Add password hashing (bcrypt)
- ⚠️ Implement refresh tokens for long sessions

## Next Steps

1. **Replace hardcoded auth** with Supabase Auth or proper user/password system
2. **Implement file uploads** for images (multipart/form-data)
3. **Add rate limiting** to prevent abuse
4. **Add pagination helpers** for large datasets
5. **Implement project switching** (multi-project support)
6. **Add expense reports** (weekly, monthly summaries)
7. **Implement webhooks** for N8N integration
8. **Add real-time updates** via WebSocket


