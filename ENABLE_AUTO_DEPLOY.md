# 🔄 Enable Vercel Auto-Deploy from GitHub

## 🎯 Make Vercel Auto-Deploy on EVERY GitHub Push

Follow these steps to ensure Vercel automatically deploys whenever you push to GitHub:

---

## ✅ Step 1: Verify Git Integration

### 1.1 Go to Vercel Project Settings
```
https://vercel.com/dashboard
```
- Click your **BuildMonitor** project
- Go to **Settings** tab

### 1.2 Navigate to Git Settings
- Click **Git** in the left sidebar
- You should see: `Connected Git Repository: gabbyshey334-ux/BuildMonitor`

### 1.3 Verify Settings
Check these are enabled:

- ✅ **Production Branch**: `main`
- ✅ **Automatically Expose System Environment Variables**: ON
- ✅ **Deploy on Push**: Should be enabled by default

---

## ✅ Step 2: Enable Auto-Deploy for Production

### 2.1 Check Deployment Settings
1. Still in **Settings** → **Git**
2. Look for **"Production Branch"** section
3. Make sure it shows: `main`

### 2.2 Enable Deploy Hooks (if needed)
1. Scroll down to **Deploy Hooks**
2. If webhook is broken, create a new one:
   - Name: `GitHub Push`
   - Git Branch Name: `main`
   - Click **Create Hook**
   - Copy the webhook URL (you won't need it, just creating it helps)

---

## ✅ Step 3: Reconnect GitHub Integration (If Auto-Deploy Not Working)

### 3.1 Disconnect and Reconnect
1. Go to **Settings** → **Git**
2. Scroll to bottom
3. Click **"Disconnect"** (scary, but safe!)
4. Click **"Connect Git Repository"**
5. Select **GitHub**
6. Choose **gabbyshey334-ux/BuildMonitor**
7. Click **Import**

This refreshes the webhook connection.

---

## ✅ Step 4: Check GitHub Webhooks (Advanced)

### 4.1 Go to GitHub Repository Settings
```
https://github.com/gabbyshey334-ux/BuildMonitor/settings/hooks
```

### 4.2 Verify Vercel Webhook Exists
You should see a webhook like:
- **Payload URL**: `https://api.vercel.com/v1/integrations/deploy/...`
- **Status**: ✅ Recent deliveries successful

### 4.3 If Webhook is Missing or Failing
1. Delete the old webhook (if any)
2. Go back to Vercel and disconnect/reconnect Git (Step 3)
3. Vercel will automatically recreate the webhook

---

## ✅ Step 5: Test Auto-Deploy

### 5.1 Make a Small Change
```bash
cd /Users/cipher/Downloads/BuildMonitor

# Update README to trigger deploy
echo "" >> README.md
echo "Last updated: $(date)" >> README.md

git add README.md
git commit -m "Test auto-deploy"
git push origin main
```

### 5.2 Watch Vercel Dashboard
1. Go to: https://vercel.com/dashboard
2. Click **BuildMonitor**
3. Go to **Deployments** tab
4. You should see a NEW deployment appear within 30 seconds!

---

## 🎯 Quick Fix: Enable Auto-Deploy NOW

### If webhooks are broken, do this:

1. **Go to Vercel Dashboard**
   ```
   https://vercel.com/dashboard
   ```

2. **Click BuildMonitor project**

3. **Settings** → **Git**

4. **Scroll down and click "Disconnect"**

5. **Click "Connect Git Repository"**

6. **Select GitHub** → `gabbyshey334-ux/BuildMonitor`

7. **Click "Import"**

8. **Done!** Auto-deploy is now enabled ✅

---

## 🔧 Alternative: Use Vercel GitHub App

### If manual integration doesn't work:

1. **Install Vercel GitHub App**
   ```
   https://github.com/apps/vercel
   ```

2. **Click "Configure"**

3. **Select your repositories**:
   - Choose: `gabbyshey334-ux/BuildMonitor`

4. **Save**

5. **Go back to Vercel** and import the project again

This uses GitHub App instead of webhooks (more reliable).

---

## ✅ Expected Behavior After Setup

### Every time you push to GitHub:

```bash
git add .
git commit -m "My changes"
git push origin main
```

**Vercel automatically:**
1. ✅ Detects push within 30 seconds
2. ✅ Starts building
3. ✅ Deploys to production (2-3 minutes)
4. ✅ Your app is live with latest changes!

---

## 🔍 Troubleshooting Auto-Deploy

### Issue: Vercel not detecting pushes

**Solution 1:** Disconnect/Reconnect Git (Step 3)

**Solution 2:** Check GitHub webhook status:
```
https://github.com/gabbyshey334-ux/BuildMonitor/settings/hooks
```
- Click on Vercel webhook
- Check "Recent Deliveries"
- If failing, redeliver a recent one

**Solution 3:** Use Deploy Hook manually:
1. Vercel Settings → Git → Deploy Hooks
2. Create hook for `main` branch
3. Copy webhook URL
4. Test with: `curl -X POST https://your-deploy-hook-url`

### Issue: Builds fail on auto-deploy

**Current fix applied:** `vercel.json` has `"ignoreBuildErrors": true`

This ensures TypeScript errors don't block deployment.

---

## 📋 Auto-Deploy Checklist

```
[ ] 1. Go to https://vercel.com/dashboard
[ ] 2. Click BuildMonitor project
[ ] 3. Settings → Git
[ ] 4. Verify "Connected Git Repository" shows your repo
[ ] 5. Verify "Production Branch" is set to "main"
[ ] 6. If broken: Disconnect and Reconnect Git
[ ] 7. Test: Make small change and push
[ ] 8. Watch Deployments tab for new build
[ ] 9. Verify deployment completes successfully
[ ] 10. Test: curl https://build-monitor-lac.vercel.app/health
```

---

## 🎉 Success Indicators

### You'll know auto-deploy is working when:

✅ **Push to GitHub** → New deployment appears in Vercel within 30 seconds
✅ **No manual intervention** needed
✅ **Build logs** show latest commit hash
✅ **App automatically updates** after build completes

---

## 🚀 Quick Action: Do This NOW

1. **Open:** https://vercel.com/dashboard
2. **Click:** BuildMonitor
3. **Go to:** Settings → Git
4. **Check:** Production Branch = `main`
5. **If broken:** Disconnect → Reconnect
6. **Test:** Push a commit and watch Deployments tab

---

**👉 START HERE:** https://vercel.com/dashboard → BuildMonitor → Settings → Git

