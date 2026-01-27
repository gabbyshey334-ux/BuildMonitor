# 🔐 Quick Push to GitHub Guide

Since GitHub CLI installation failed, here's a simple alternative:

---

## 🚀 Method 1: Use the Helper Script (Easiest)

Run this in your terminal:

```bash
cd /Users/cipher/Downloads/BuildMonitor
./push-to-github.sh
```

The script will guide you through:
1. Creating a GitHub Personal Access Token
2. Securely pushing your code
3. Automatically cleaning up credentials

---

## 🔐 Method 2: Manual Push with Token

### Step 1: Create Personal Access Token

1. Go to: https://github.com/settings/tokens/new
2. **Note**: `BuildMonitor Deployment`
3. **Expiration**: `90 days` (or your preference)
4. **Select scopes**: ✓ `repo` (Full control)
5. Click **"Generate token"**
6. **COPY THE TOKEN** (looks like `ghp_xxxxxxxxxxxx...`)

### Step 2: Push to GitHub

```bash
cd /Users/cipher/Downloads/BuildMonitor

# Replace YOUR_TOKEN with your actual token
git remote set-url origin https://YOUR_TOKEN@github.com/gabbyshey334-ux/BuildMonitor.git

# Push to GitHub
git push -u origin main

# Clean up (remove token from config)
git remote set-url origin https://github.com/gabbyshey334-ux/BuildMonitor.git
```

---

## ✅ After Pushing

1. **Vercel auto-deploys** (2-3 minutes)
2. **Check deployment**: https://vercel.com/dashboard
3. **Test your app**: https://build-monitor-lac.vercel.app/health
4. **Expected result**:
   ```json
   {
     "status": "ok",
     "database": { "connected": true }
   }
   ```

---

## 🔧 What Was Fixed

The following changes will be deployed:

1. ✅ **vercel.json** - Updated to use `api/index.ts` instead of `server/index.ts`
2. ✅ **api/index.ts** - Fixed export format for Vercel serverless functions

These fixes resolve the **404 NOT_FOUND** error you were seeing.

---

## 🆘 Troubleshooting

### Token Authentication Failed
- Verify token is copied correctly (no spaces)
- Ensure `repo` scope is selected
- Token must not be expired

### Push Rejected
- Check repository permissions
- Verify repository URL: `https://github.com/gabbyshey334-ux/BuildMonitor`

### Network Timeout
- Check internet connection
- Try again in a few minutes
- Consider using SSH instead (see Method 3 in main DEPLOYMENT.md)

---

**Ready? Run the helper script:**
```bash
cd /Users/cipher/Downloads/BuildMonitor
./push-to-github.sh
```

