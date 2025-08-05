#!/usr/bin/env node

/**
 * EMERGENCY RAILWAY CRASH DIAGNOSTICS
 * Run this immediately after deployment failure
 */

const fs = require('fs');
const path = require('path');

console.log('🚨 EMERGENCY RAILWAY CRASH DIAGNOSTICS\n');

// 1. Check package.json dependencies
console.log('=== DEPENDENCY CHECK ===');
try {
  const packagePath = path.join(__dirname, 'notification-service', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  const criticalDeps = ['express', 'cors', 'helmet', 'dotenv', '@supabase/supabase-js', 'resend', 'axios'];
  
  criticalDeps.forEach(dep => {
    if (packageJson.dependencies[dep]) {
      console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`❌ MISSING: ${dep}`);
    }
  });
} catch (error) {
  console.log('❌ Cannot read package.json:', error.message);
}

// 2. Check Dockerfile build context
console.log('\n=== DOCKERFILE CHECK ===');
try {
  const dockerfilePath = path.join(__dirname, '..', 'Dockerfile');
  const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
  
  if (dockerfile.includes('COPY railway/notification-service/package*.json ./')) {
    console.log('✅ Package files copied correctly');
  } else {
    console.log('❌ Package files copy path incorrect');
  }
  
  if (dockerfile.includes('COPY railway/notification-service/ .')) {
    console.log('✅ Source files copied correctly');
  } else {
    console.log('❌ Source files copy path incorrect');
  }
  
  if (dockerfile.includes('ENV PORT=${PORT:-3001}')) {
    console.log('✅ Port environment variable set');
  } else {
    console.log('❌ Port environment not configured');
  }
} catch (error) {
  console.log('❌ Cannot read Dockerfile:', error.message);
}

// 3. Check critical file existence
console.log('\n=== FILE EXISTENCE CHECK ===');
const criticalFiles = [
  'notification-service/src/server.js',
  'notification-service/src/services/NotificationService.js',
  'notification-service/src/routes/health.js',
  'notification-service/src/routes/notifications.js',
  'notification-service/src/routes/webhooks.js'
];

criticalFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ MISSING: ${file}`);
  }
});

// 4. Check environment variables template
console.log('\n=== ENVIRONMENT VARIABLES NEEDED ===');
const requiredEnvVars = [
  'NODE_ENV=production',
  'PORT=3001',
  'SUPABASE_URL=https://your-project.up.railway.app',
  'SUPABASE_SERVICE_ROLE_KEY=your-service-role-key',
  'RETELL_API_KEY=key_your-retell-key',
  'RESEND_API_KEY=re_your-resend-key',
  'WEBHOOK_SECRET=auto-alert-webhook-secret-2024',
  'FRONTEND_URL=https://auto-alert.vercel.app'
];

console.log('Required in Railway Service Variables:');
requiredEnvVars.forEach(env => {
  console.log(`   ${env}`);
});

// 5. Health check test
console.log('\n=== HEALTH CHECK SIMULATION ===');
console.log('Testing health endpoint logic...');

// Simulate environment check
const testEnv = {
  SUPABASE_URL: 'test',
  SUPABASE_SERVICE_ROLE_KEY: 'test',
  RETELL_API_KEY: 'test',
  RESEND_API_KEY: 'test'
};

const missing = Object.keys(testEnv).filter(key => !process.env[key]);
if (missing.length > 0) {
  console.log(`❌ Health check would fail due to missing env vars: ${missing.join(', ')}`);
} else {
  console.log('✅ Environment variables would pass health check');
}

console.log('\n' + '='.repeat(60));
console.log('🔧 IMMEDIATE FIXES NEEDED:');
console.log('1. Fix resend import in NotificationService.js');
console.log('2. Set all environment variables in Railway');
console.log('3. Ensure database tables exist');
console.log('4. Test health endpoint before deployment');
console.log('\n📞 EMERGENCY RESTART PROCEDURE:');
console.log('   Railway Dashboard → Service → Settings → Restart');
console.log('   Check logs immediately after restart');