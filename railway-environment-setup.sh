#!/bin/bash

# Railway Environment Setup Script
# Sets all required environment variables for Auto Alert SaaS

echo "🔧 Setting up Railway environment variables..."

# Required variables check
check_variable() {
  if [ -z "$2" ]; then
    echo "❌ $1 is required but not set"
    exit 1
  else
    echo "✅ $1 set"
  fi
}

# Generate secure secrets if not provided
generate_secret() {
  if [ -z "$1" ]; then
    openssl rand -hex 32
  else
    echo "$1"
  fi
}

# Core configuration
WEBHOOK_SECRET=$(generate_secret "$WEBHOOK_SECRET")
JWT_SECRET=$(generate_secret "$JWT_SECRET")

echo "Generated secrets:"
echo "WEBHOOK_SECRET: ${WEBHOOK_SECRET:0:8}..."
echo "JWT_SECRET: ${JWT_SECRET:0:8}..."

# Railway CLI commands to set environment variables
echo "Setting environment variables in Railway..."

# Required variables
railway variables set NODE_ENV=production
railway variables set WEBHOOK_SECRET="$WEBHOOK_SECRET"
railway variables set JWT_SECRET="$JWT_SECRET"

# Database - Railway will provide these automatically with PostgreSQL addon
echo "ℹ️  Add PostgreSQL addon in Railway dashboard for DATABASE_URL"

# Optional services (uncomment and set if you have these)
# railway variables set RETELL_API_KEY="your_retell_api_key"
# railway variables set RETELL_AGENT_ID="your_retell_agent_id" 
# railway variables set RETELL_PHONE_NUMBER="your_retell_phone_number"
# railway variables set RESEND_API_KEY="your_resend_api_key"
# railway variables set TEST_API_KEY="your_test_api_key"

# Infrastructure
railway variables set FRONTEND_URL="https://auto-alert.vercel.app"
railway variables set RATE_LIMIT_MAX="1000"
railway variables set RATE_LIMIT_WINDOW="900000"

echo "🎉 Environment setup complete!"
echo "📝 Next steps:"
echo "1. Add PostgreSQL addon in Railway dashboard"
echo "2. Configure optional service API keys as needed"
echo "3. Deploy with: railway up"