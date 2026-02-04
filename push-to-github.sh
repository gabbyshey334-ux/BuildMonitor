#!/bin/bash

echo "=========================================="
echo "🔐 GitHub Push Authentication Guide"
echo "=========================================="
echo ""
echo "Since GitHub CLI installation failed, we'll use a Personal Access Token."
echo ""
echo "📋 STEP 1: Create a GitHub Personal Access Token"
echo "----------------------------------------"
echo "1. Open your browser and go to:"
echo "   https://github.com/settings/tokens/new"
echo ""
echo "2. Configure the token:"
echo "   - Note: JengaTrack Deployment"
echo "   - Expiration: 90 days (or your preference)"
echo "   - Select scopes: ✓ repo (Full control of private repositories)"
echo ""
echo "3. Click 'Generate token' at the bottom"
echo ""
echo "4. COPY THE TOKEN (you'll only see it once!)"
echo "   It looks like: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
echo ""
echo "=========================================="
echo ""
read -p "Have you copied your token? (y/n): " ready
echo ""

if [ "$ready" != "y" ]; then
    echo "❌ Please create and copy your token first, then run this script again."
    exit 1
fi

echo "📋 STEP 2: Enter Your Personal Access Token"
echo "----------------------------------------"
read -sp "Paste your GitHub token here: " token
echo ""
echo ""

if [ -z "$token" ]; then
    echo "❌ No token provided. Exiting."
    exit 1
fi

echo "🔧 Configuring Git remote..."
git remote set-url origin "https://$token@github.com/gabbyshey334-ux/BuildMonitor.git"

echo ""
echo "🚀 Pushing to GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ SUCCESS! Code pushed to GitHub"
    echo "=========================================="
    echo ""
    echo "🔄 Vercel will now automatically redeploy"
    echo "   Visit: https://vercel.com/dashboard"
    echo "   Wait 2-3 minutes for deployment"
    echo ""
    echo "✅ Once deployed, test your app:"
    echo "   https://build-monitor-lac.vercel.app/health"
    echo ""
    echo "🔐 Security Note: Clean up the remote URL"
    git remote set-url origin "https://github.com/gabbyshey334-ux/BuildMonitor.git"
    echo "   ✓ Token removed from Git config"
    echo ""
else
    echo ""
    echo "❌ Push failed. Check the error above."
    echo ""
    echo "Common issues:"
    echo "  - Invalid or expired token"
    echo "  - Token doesn't have 'repo' scope"
    echo "  - Network connection issues"
    echo ""
fi

