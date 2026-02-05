# JWT Token-Based Authentication - Setup Complete ✅

## What Changed

We've switched from session-based authentication to JWT token-based authentication. This is the industry-standard approach for serverless environments like Vercel.

## How It Works

1. **User logs in** → Server returns JWT token
2. **Frontend stores token** in localStorage
3. **Frontend sends token** in `Authorization: Bearer <token>` header with each request
4. **Backend verifies token** and extracts user ID

## Required Environment Variable

**CRITICAL:** Set this in Vercel Dashboard → Settings → Environment Variables:

```bash
JWT_SECRET=your-super-secret-random-string-for-jwt-signing
```

### Generate a Secure JWT_SECRET

Run this in Node.js or browser console:

```javascript
// Node.js
require('crypto').randomBytes(64).toString('hex')

// Browser
crypto.randomUUID() + crypto.randomUUID() + crypto.randomUUID() + crypto.randomUUID()
```

**Minimum length:** 32 characters (64+ recommended)

## What Was Updated

### Backend (`api/index.js`)
- ✅ Created JWT utility functions (`api/utils/jwt.js`)
- ✅ Replaced `requireAuth` middleware to verify JWT tokens
- ✅ Updated `/api/auth/login` to return JWT token
- ✅ Updated `/api/auth/register` to return JWT token
- ✅ Updated `/api/auth/me` to use JWT token
- ✅ Updated all protected endpoints to use `req.userId` from JWT
- ✅ Removed session dependencies

### Frontend
- ✅ Created `authToken.ts` utility for token management
- ✅ Updated `AuthContext.tsx` to store tokens in localStorage
- ✅ Updated `queryClient.ts` to include Authorization header
- ✅ Auto-clears token on 401 responses

## Testing

After deployment, test in browser console:

```javascript
// 1. Login (returns token)
fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'password'
  })
})
  .then(r => r.json())
  .then(d => {
    console.log('Login:', d);
    // Token is stored automatically in localStorage
    console.log('Token stored:', localStorage.getItem('auth_token'));
  });

// 2. Check auth (uses token from localStorage)
fetch('/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
  }
})
  .then(r => r.json())
  .then(d => console.log('Auth check:', d));

// 3. Create project (uses token automatically)
fetch('/api/projects', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
  },
  body: JSON.stringify({
    name: 'Test Project',
    description: 'Testing',
    budget: 1000000,
    currency: 'UGX'
  })
})
  .then(r => r.json())
  .then(d => console.log('Create project:', d));
```

## Expected Results

✅ Login returns `{ success: true, token: "...", user: {...} }`
✅ Token stored in localStorage as `auth_token`
✅ All API requests include `Authorization: Bearer <token>` header
✅ `/api/auth/me` returns user info (not 401)
✅ Projects can be created successfully
✅ No more session persistence issues

## Token Expiry

Tokens are valid for **7 days** by default. After expiry:
- User will get 401 Unauthorized
- Token is automatically cleared from localStorage
- User needs to log in again

## Logout

Logout simply clears the token from localStorage. No server-side action needed.

## Troubleshooting

### "Invalid token" errors
- Check that `JWT_SECRET` is set in Vercel
- Verify token hasn't expired (7 days)
- Check browser console for token in localStorage

### "Not authenticated" errors
- Verify token exists: `localStorage.getItem('auth_token')`
- Check that Authorization header is being sent
- Verify token format: `Bearer <token>`

### Token not persisting
- Check browser localStorage (not sessionStorage)
- Verify token is being stored after login
- Check browser console for errors

## Migration Notes

- **Old sessions are no longer valid** - users need to log in again
- **No cookies needed** - everything uses Authorization header
- **Works across domains** - no CORS cookie issues
- **Stateless** - perfect for serverless

## Security Notes

- Tokens are stored in localStorage (XSS risk - acceptable for MVP)
- Tokens expire after 7 days
- Tokens are signed with JWT_SECRET (keep it secret!)
- HTTPS required in production (Vercel provides this)

---

**Status:** ✅ Complete and ready for deployment!

**Next Step:** Set `JWT_SECRET` in Vercel environment variables and redeploy.

