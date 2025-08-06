#!/usr/bin/env node

/**
 * Railway Deployment Preparation Script
 * Prepares the auto-alert-saas backend service for Railway deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🚂 Preparing Auto-Alert SaaS for Railway Deployment...\n');

// Check required environment variables template
const envTemplate = `# Railway Environment Variables Template
# Copy these to your Railway service

NODE_ENV=production
PORT=3001
SUPABASE_URL=https://kong-production-9e43.up.railway.app
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
RETELL_API_KEY=key_your-retell-key-here
RESEND_API_KEY=re_your-resend-key-here
WEBHOOK_SECRET=auto-alert-webhook-secret-2024
FRONTEND_URL=https://auto-alert.vercel.app
`;

// Create deployment checklist
const deploymentChecklist = `
# 🚂 Railway Deployment Checklist

## Before Deployment:

- [ ] GitHub repository connected (Dali1789/auto-alert-saas)
- [ ] Railway project created
- [ ] Database setup completed (railway/setup-database.sql)
- [ ] Environment variables configured

## Deployment Steps:

1. **Create New Service in Railway:**
   - Go to Railway Dashboard
   - Click "New Service"
   - Select "Deploy from GitHub repo"
   - Choose: Dali1789/auto-alert-saas

2. **Configure Service:**
   - Service Name: auto-alert-notifications
   - Root Directory: / (leave empty)
   - Start Command: npm start
   - Port: 3001

3. **Set Environment Variables:**
   - Copy all variables from .env.railway
   - Paste in Railway Variables tab

4. **Enable Public Domain:**
   - Go to Settings → Networking
   - Generate Domain
   - Note the URL for testing

## After Deployment:

- [ ] Health check passed (/health endpoint)
- [ ] Database connections verified
- [ ] Retell AI integration tested
- [ ] Resend email service tested
- [ ] Webhook endpoints accessible

## Testing Commands:

\`\`\`bash
# Health Check
curl https://your-service.railway.app/health

# Test Webhook
curl -X POST https://your-service.railway.app/api/webhooks/test \\
  -H "Content-Type: application/json" \\
  -d '{"testEmail": "test@example.com"}'
\`\`\`
`;

// Save environment template
fs.writeFileSync(
  path.join(__dirname, '..', '.env.railway'),
  envTemplate,
  'utf8'
);

// Save deployment checklist
fs.writeFileSync(
  path.join(__dirname, '..', 'RAILWAY_DEPLOYMENT_CHECKLIST.md'),
  deploymentChecklist,
  'utf8'
);

// Verify critical files
console.log('✅ Checking critical files...');

const criticalFiles = [
  'railway.json',
  'package.json',
  'railway/notification-service/src/server.js',
  'railway/notification-service/Dockerfile',
  'railway/setup-database.sql'
];

criticalFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✓ ${file} exists`);
  } else {
    console.log(`  ✗ ${file} MISSING!`);
  }
});

console.log('\n📋 Deployment preparation complete!');
console.log('\n📄 Files created:');
console.log('  - .env.railway (environment variables template)');
console.log('  - RAILWAY_DEPLOYMENT_CHECKLIST.md (deployment guide)');
console.log('\n🚀 Next steps:');
console.log('  1. Review RAILWAY_DEPLOYMENT_CHECKLIST.md');
console.log('  2. Copy environment variables from .env.railway');
console.log('  3. Deploy to Railway following the checklist');