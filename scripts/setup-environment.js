#!/usr/bin/env node
/**
 * Environment Setup Script for Auto Alert SaaS
 * Generates secure secrets and validates configuration
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔧 Auto Alert SaaS - Environment Setup');
console.log('=====================================\n');

// Generate secure secrets
const webhookSecret = crypto.randomBytes(32).toString('hex');
const jwtSecret = crypto.randomBytes(32).toString('hex');

console.log('✅ Generated Security Secrets:');
console.log('WEBHOOK_SECRET=' + webhookSecret);
console.log('JWT_SECRET=' + jwtSecret);

// Create local development environment
const devEnv = `# Development Environment - Auto Alert SaaS
NODE_ENV=development
PORT=3001

# Security Secrets (Generated: ${new Date().toISOString()})
WEBHOOK_SECRET=${webhookSecret}
JWT_SECRET=${jwtSecret}

# Database Configuration
# Replace with your actual database URL
DATABASE_URL=postgresql://user:password@localhost:5432/autoalert
POSTGRES_URL=postgresql://user:password@localhost:5432/autoalert

# Supabase Configuration (Optional)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key

# Services Configuration (Optional)
RETELL_API_KEY=key_your_retell_api_key
RETELL_AGENT_ID=agent_your_retell_agent_id
RETELL_PHONE_NUMBER=+1234567890
RESEND_API_KEY=re_your_resend_api_key
TEST_API_KEY=test_api_key_here

# Redis Cache (Optional)
REDIS_URL=redis://localhost:6379

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=900000

# Mobile.de Integration
MOBILE_DE_API_KEY=your_mobile_de_api_key
MOBILE_DE_USER_ID=your_mobile_de_user_id
`;

// Write development environment file
fs.writeFileSync('.env.development', devEnv);
console.log('\n📝 Created .env.development file');

// Railway deployment commands
const railwayCommands = `
🚀 Railway Deployment Commands:
===============================

# 1. Login to Railway (run in browser)
railway login

# 2. Initialize project
railway init

# 3. Add PostgreSQL database
railway add postgresql

# 4. Set environment variables
railway variables set NODE_ENV=production
railway variables set WEBHOOK_SECRET="${webhookSecret}"
railway variables set JWT_SECRET="${jwtSecret}"
railway variables set FRONTEND_URL="https://auto-alert.vercel.app"

# 5. Optional services
railway variables set RESEND_API_KEY="re_..."
railway variables set RETELL_API_KEY="key_..."
railway variables set RETELL_AGENT_ID="agent_..."

# 6. Deploy
railway up

# 7. Check deployment
railway logs
railway status
`;

console.log(railwayCommands);

// Production environment template
const prodEnvTemplate = `# Production Environment Template - Auto Alert SaaS
NODE_ENV=production
PORT=3001

# Security Secrets
WEBHOOK_SECRET=${webhookSecret}
JWT_SECRET=${jwtSecret}

# Database Configuration (Auto-set by Railway when adding PostgreSQL)
DATABASE_URL=\${DATABASE_URL}
POSTGRES_URL=\${POSTGRES_URL}

# Supabase Configuration (Fallback)
SUPABASE_URL=\${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=\${SUPABASE_SERVICE_ROLE_KEY}
SUPABASE_ANON_KEY=\${SUPABASE_ANON_KEY}

# Services
RETELL_API_KEY=\${RETELL_API_KEY}
RETELL_AGENT_ID=\${RETELL_AGENT_ID}
RETELL_PHONE_NUMBER=\${RETELL_PHONE_NUMBER}
RESEND_API_KEY=\${RESEND_API_KEY}
TEST_API_KEY=\${TEST_API_KEY}

# Redis Cache (Optional)
REDIS_URL=\${REDIS_URL}

# Frontend
FRONTEND_URL=https://auto-alert.vercel.app

# Rate Limiting
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=900000

# Mobile.de Integration
MOBILE_DE_API_KEY=\${MOBILE_DE_API_KEY}
MOBILE_DE_USER_ID=\${MOBILE_DE_USER_ID}
`;

fs.writeFileSync('.env.production.template', prodEnvTemplate);
console.log('📝 Created .env.production.template file');

console.log('\n🎯 Next Steps:');
console.log('1. Update DATABASE_URL in .env.development for local testing');
console.log('2. Run: railway login (opens browser)');
console.log('3. Run: railway init');  
console.log('4. Run: railway add postgresql');
console.log('5. Copy the generated secrets to Railway using the commands above');
console.log('6. Deploy with: railway up');

console.log('\n✅ Environment setup completed successfully!');