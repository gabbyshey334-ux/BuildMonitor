#!/bin/bash
# Generate a secure SESSION_SECRET for your .env file

echo "🔐 Generating secure SESSION_SECRET..."
echo ""
echo "Copy this to your .env file:"
echo ""
echo "SESSION_SECRET=$(openssl rand -base64 32)"
echo ""
echo "Or run this command directly:"
echo "echo \"SESSION_SECRET=\$(openssl rand -base64 32)\" >> .env"


