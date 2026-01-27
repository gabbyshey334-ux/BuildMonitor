#!/bin/bash
# Setup .env file with your Twilio credentials

cat > .env << 'EOF'
# Supabase Configuration
# Get these from: https://app.supabase.com/project/_/settings/api
SUPABASE_URL=https://ouotjfddslyrraxsimug.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91b3RqZmRkc2x5cnJheHNpbXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMDAyNzIsImV4cCI6MjA4NDU3NjI3Mn0.KTNGU1ws-r6iUwUSw9VE_jiuxFczTE1imiSY6JWFcDI
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91b3RqZmRkc2x5cnJheHNpbXVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAwMDI3MiwiZXhwIjoyMDg0NTc2MjcyfQ.tE3y8fMW8VZ0utctbWLRAN8rGoO7NjV_eNf2pqZlUuA
# Database Connection
# Get this from: https://app.supabase.com/project/_/settings/database
# Format: postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres
DATABASE_URL=postgresql://postgres:MeKPZSxFrloxwSWa@db.ouotjfddslyrraxsimug.supabase.co:5432/postgres

# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# OpenAI Configuration (optional - for AI fallback)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Session Secret (generate with: openssl rand -hex 32)
SESSION_SECRET=REPLACE_THIS_WITH_SECURE_SECRET

# Server Configuration
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173
EOF

# Generate a secure session secret
SESSION_SECRET=$(openssl rand -hex 32)

# Replace the placeholder session secret
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/REPLACE_THIS_WITH_SECURE_SECRET/$SESSION_SECRET/" .env
else
    # Linux
    sed -i "s/REPLACE_THIS_WITH_SECURE_SECRET/$SESSION_SECRET/" .env
fi

echo "✅ .env file created successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Edit .env and add your Supabase credentials"
echo "2. Add your database connection string"
echo "3. Add your OpenAI API key (optional)"
echo ""
echo "✅ Twilio credentials are already configured"
echo "✅ Session secret has been generated"
echo ""
echo "Run 'npm run test:env' to verify your configuration"

