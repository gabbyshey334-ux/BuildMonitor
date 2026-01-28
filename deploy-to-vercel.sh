#!/bin/bash

echo "=========================================="
echo "🚀 Deploying BuildMonitor to Vercel"
echo "=========================================="
echo ""
echo "This will deploy directly to your existing Vercel project."
echo "It will:"
echo "  1. Link to gabbyshey334-ux/BuildMonitor"
echo "  2. Deploy the fixes (vercel.json + api/index.ts)"
echo "  3. Fix your 404 error!"
echo ""
echo "Press Enter to continue..."
read

cd /Users/cipher/Downloads/BuildMonitor

echo ""
echo "🔗 Linking to Vercel project..."
echo ""

# Deploy directly to production
vercel --prod

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    echo "=========================================="
    echo ""
    echo "🎉 Your app is now live!"
    echo "📱 Test it: https://build-monitor-lac.vercel.app/health"
    echo ""
    echo "✅ The 404 error should be fixed!"
    echo ""
else
    echo ""
    echo "❌ Deployment failed. Check the error above."
    echo ""
    echo "You may need to:"
    echo "  1. Login to Vercel: vercel login"
    echo "  2. Try again: vercel --prod"
    echo ""
fi


