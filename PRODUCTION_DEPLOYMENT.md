# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables Setup
Copy `.env.example` to `.env` and set these **required** variables:

```bash
# Database (Required)
DATABASE_URL=postgresql://username:password@host:port/database

# Security (Required)
SESSION_SECRET=your-super-secure-random-string-here

# Replit Auth (Required if using Replit)
REPLIT_DOMAINS=your-replit-domain.com
REPL_ID=your-repl-id
ISSUER_URL=https://replit.com/oidc

# Server Config
NODE_ENV=production
PORT=5000
```

### 2. Generate Secure Session Secret
```bash
# Run this command to generate a secure session secret:
openssl rand -base64 32
```

### 3. Database Setup
- Ensure PostgreSQL database is provisioned
- Run schema migration: `npm run db:push`
- Verify database connection works

### 4. Security Configuration
✅ **Automatically configured in production:**
- Secure cookies (HTTPS only)
- Strict SameSite cookie policy
- Session secret validation
- CSRF protection

### 5. Build and Deploy
```bash
# Build the application
npm run build

# Start production server
npm start
```

## Production Environment Features

### 🔒 Security Enhancements
- **Secure Session Management**: Production automatically uses secure cookies
- **Environment Validation**: Server won't start without required environment variables
- **No Default Secrets**: Prevents using development secrets in production

### 🚀 Performance Optimizations
- **Static Asset Serving**: Optimized for production traffic
- **Database Connection Pooling**: Uses Neon Database for scalability
- **Transaction Safety**: All financial operations use database transactions

### 📊 Monitoring & Logging
- **Request Logging**: API calls are logged with timing information
- **Error Handling**: Comprehensive error responses
- **Health Checks**: Built-in endpoint monitoring

## Troubleshooting

### Common Issues

**Server won't start in production:**
- Check all required environment variables are set
- Verify DATABASE_URL is accessible
- Ensure SESSION_SECRET is set

**Authentication not working:**
- Verify cookie security settings
- Check HTTPS is properly configured
- Ensure session store is accessible

**Database connection issues:**
- Verify DATABASE_URL format and credentials
- Check database server is accessible
- Run `npm run db:push` to sync schema

## Maintenance

### Regular Tasks
1. **Monitor logs** for errors and performance issues
2. **Update dependencies** regularly for security patches
3. **Backup database** regularly
4. **Monitor disk space** and database size

### Security Updates
- Review and rotate SESSION_SECRET periodically
- Keep dependencies updated
- Monitor for security advisories

---

## Support

For deployment issues:
1. Check this guide first
2. Verify environment variables
3. Check application logs
4. Review database connectivity