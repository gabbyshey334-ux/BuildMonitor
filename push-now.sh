#!/bin/bash
# Quick script to push to GitHub with Personal Access Token

echo "🚀 Pushing 22 commits to GitHub..."
echo ""
echo "📋 Commits to push:"
git log --oneline origin/main..HEAD | wc -l
echo ""
echo "⚠️  If you see authentication errors, follow these steps:"
echo ""
echo "1. Go to: https://github.com/settings/tokens"
echo "2. Click: 'Generate new token' → 'Generate new token (classic)'"
echo "3. Name: 'Vercel Deploy'"
echo "4. Select scope: ✅ 'repo' (full control)"
echo "5. Click: 'Generate token'"
echo "6. COPY THE TOKEN"
echo ""
echo "7. Then run:"
echo "   git remote set-url origin https://YOUR_TOKEN@github.com/gabbyshey334-ux/BuildMonitor.git"
echo "   git push origin main"
echo ""
echo "Or use SSH (if you have SSH keys set up):"
echo "   git remote set-url origin git@github.com:gabbyshey334-ux/BuildMonitor.git"
echo "   git push origin main"
echo ""

# Try to push
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo "🚀 Vercel will auto-deploy in a few minutes"
else
    echo ""
    echo "❌ Push failed. Please follow the authentication steps above."
fi

