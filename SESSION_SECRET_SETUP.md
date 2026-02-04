# SESSION_SECRET Setup Guide

## Why SESSION_SECRET is Important

The `SESSION_SECRET` is used to sign and encrypt session cookies. Without a secure, unique secret:
- Sessions can be hijacked
- User authentication will fail
- Login/signup will return 500 errors

## Generated SESSION_SECRET

**⚠️ IMPORTANT: Keep this secret secure and never commit it to git!**

```
SESSION_SECRET=77e6061cd23bf8d293902bfe3c8e1cbe7eaf1664425db5fbb3704b761b39049d
```

## Setup Instructions

### 1. Local Development (.env file)

Add to your `.env` file in the project root:

```env
SESSION_SECRET=77e6061cd23bf8d293902bfe3c8e1cbe7eaf1664425db5fbb3704b761b39049d
```

### 2. Vercel Production

1. Go to your Vercel project dashboard
2. Navigate to: **Settings** → **Environment Variables**
3. Click **"Add New"**
4. Add:
   - **Name**: `SESSION_SECRET`
   - **Value**: `77e6061cd23bf8d293902bfe3c8e1cbe7eaf1664425db5fbb3704b761b39049d`
   - **Environment**: Select all (Production, Preview, Development)
5. Click **"Save"**
6. **Redeploy** your application for changes to take effect

### 3. Generate a New Secret (Optional)

If you need to generate a new secret:

```bash
node generate-session-secret.js
```

Or manually:

```bash
openssl rand -hex 32
```

## Troubleshooting

### Error: "SESSION_SECRET must be set in production environment"

**Solution**: Make sure `SESSION_SECRET` is set in your Vercel environment variables and redeploy.

### Login/Signup returns 500 errors

**Possible causes**:
1. Missing `SESSION_SECRET` in environment variables
2. Session cookie configuration issues
3. Database connection issues (check `DATABASE_URL`)

**Check**:
- Verify `SESSION_SECRET` is set in Vercel
- Check server logs for specific error messages
- Ensure `DATABASE_URL` is correct and accessible

### Sessions not persisting

**Solution**: 
- Verify cookies are enabled in browser
- Check that `secure: true` is only used with HTTPS
- Ensure `sameSite: 'lax'` is set for Vercel compatibility

## Security Notes

- ✅ Use a long, random secret (64+ characters)
- ✅ Never commit secrets to git
- ✅ Use different secrets for development and production
- ✅ Rotate secrets periodically
- ✅ Keep secrets in environment variables only

## Related Environment Variables

Make sure these are also set:

- `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key (for login)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for signup)

