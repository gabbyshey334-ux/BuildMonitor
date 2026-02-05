# Supabase Auth Integration - Setup Guide

## ✅ What Changed

The authentication system has been switched from custom password authentication to **Supabase Auth**.

### Before:
- Custom password hashing with `bcryptjs`
- `password_hash` column in `profiles` table
- Manual password verification

### After:
- **Supabase Auth** handles all authentication
- Users created in Supabase Auth (not just profiles table)
- No `password_hash` column needed
- Secure, managed authentication service

---

## 🔧 Required Environment Variables

Set these in **Vercel Dashboard** → **Project Settings** → **Environment Variables**:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here  # ⚠️ Keep secret!
SESSION_SECRET=your_random_secret_string
DATABASE_URL=your_postgresql_connection_string
```

### Where to Find Supabase Keys:

1. Go to **Supabase Dashboard** → **Your Project**
2. Go to **Settings** → **API**
3. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **Keep this secret!**

---

## 📋 API Endpoints

### POST `/api/auth/register`
Register a new user with Supabase Auth.

**Request:**
```json
{
  "fullName": "John Doe",
  "whatsappNumber": "+256700000001",
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "fullName": "John Doe",
    "whatsappNumber": "+256700000001"
  },
  "session": {
    "access_token": "...",
    "refresh_token": "..."
  }
}
```

### POST `/api/auth/login`
Login with Supabase Auth.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "fullName": "John Doe",
    "whatsappNumber": "+256700000001"
  },
  "session": {
    "access_token": "...",
    "refresh_token": "..."
  }
}
```

### GET `/api/auth/me`
Get current authenticated user.

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "fullName": "John Doe",
    "whatsappNumber": "+256700000001",
    "defaultCurrency": "UGX",
    "preferredLanguage": "en"
  }
}
```

### POST `/api/auth/logout`
Logout and destroy session.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 🚀 How It Works

1. **Register:**
   - Creates user in Supabase Auth
   - Creates profile in `profiles` table (linked by `id`)
   - Creates session and returns tokens

2. **Login:**
   - Authenticates with Supabase Auth
   - Fetches user profile from `profiles` table
   - Creates Express session with Supabase tokens

3. **Session:**
   - Express session stores `userId`, `email`, `accessToken`, `refreshToken`
   - Cookie: `jengatrack.sid` (httpOnly, secure, sameSite: 'none')

4. **Auth Check:**
   - `requireAuth` middleware checks `req.session.userId`
   - Optionally verifies with Supabase Auth if token exists

---

## 📝 Database Schema

The `profiles` table structure:
- `id` (UUID) - **Must match** `auth.users.id` from Supabase
- `email` (VARCHAR) - User email
- `whatsapp_number` (VARCHAR) - WhatsApp number
- `full_name` (VARCHAR) - Full name
- `default_currency` (VARCHAR) - Default currency (default: 'UGX')
- `preferred_language` (VARCHAR) - Preferred language (default: 'en')
- `created_at`, `updated_at`, `deleted_at` - Timestamps

**No `password_hash` column needed!** (Can be removed with migration)

---

## 🔄 Migration Steps

### Optional: Remove password_hash column

If you want to clean up the database:

```sql
-- Run in Supabase SQL Editor
-- migrations/remove_password_hash.sql
```

This is **optional** - the column can remain but won't be used.

---

## ✅ Testing

### 1. Register a new user:
```bash
curl -X POST https://your-app.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "whatsappNumber": "+256700000001",
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

### 2. Login:
```bash
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }' \
  -c cookies.txt
```

### 3. Get profile:
```bash
curl -X GET https://your-app.vercel.app/api/auth/me \
  -b cookies.txt
```

### 4. Logout:
```bash
curl -X POST https://your-app.vercel.app/api/auth/logout \
  -b cookies.txt
```

---

## 🎯 Benefits of Supabase Auth

✅ **Secure**: Managed by Supabase (industry-standard)
✅ **No password storage**: Passwords never stored in your database
✅ **Email verification**: Built-in email confirmation
✅ **Password reset**: Built-in password reset flow
✅ **Multi-factor auth**: Can be enabled later
✅ **Social login**: Can add Google, GitHub, etc. later
✅ **Session management**: Handled by Supabase

---

## ⚠️ Important Notes

1. **User ID Matching**: The `profiles.id` must match `auth.users.id` from Supabase
2. **Service Role Key**: Keep `SUPABASE_SERVICE_ROLE_KEY` secret - never expose to frontend
3. **Anon Key**: `SUPABASE_ANON_KEY` is safe for frontend use
4. **Session Cookies**: Cookies are set with `sameSite: 'none'` for cross-site support on Vercel

---

## 🐛 Troubleshooting

### Error: "Invalid credentials"
- User doesn't exist in Supabase Auth
- Password is incorrect
- Check Supabase Dashboard → Authentication → Users

### Error: "User profile not found"
- User exists in Supabase Auth but not in `profiles` table
- Run register endpoint to create profile

### Error: "SUPABASE_URL not configured"
- Set environment variables in Vercel
- Check that keys are correct

### Error: "Session invalid"
- Token expired or invalid
- User needs to login again

---

## ✅ Status

- ✅ Login endpoint: Uses Supabase Auth
- ✅ Register endpoint: Creates user in Supabase Auth
- ✅ /me endpoint: Verifies with Supabase Auth
- ✅ Logout endpoint: Signs out from Supabase
- ✅ Session management: Stores Supabase tokens
- ✅ All changes pushed to GitHub

**Authentication is now fully integrated with Supabase Auth!** 🎉

