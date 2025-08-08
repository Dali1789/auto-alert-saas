#!/usr/bin/env node

/**
 * Production Setup Script for Railway Deployment
 * Runs after npm install to prepare the application for production
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Auto Alert SaaS for production deployment...');

/**
 * Validate that required files exist
 */
function validateRequiredFiles() {
  const requiredFiles = [
    'server.js',
    'railway/notification-service/src/server.js',
    'railway/notification-service/src/config/environment.js'
  ];

  const missing = requiredFiles.filter(file => {
    const filePath = path.join(process.cwd(), file);
    return !fs.existsSync(filePath);
  });

  if (missing.length > 0) {
    console.error('❌ Missing required files:', missing);
    process.exit(1);
  }

  console.log('✅ All required files present');
}

/**
 * Create necessary directories
 */
function createDirectories() {
  const directories = [
    'logs',
    'temp',
    'uploads',
    'storage/cache',
    'storage/files',
    'storage/exports'
  ];

  directories.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });

  console.log('✅ Required directories created');
}

/**
 * Validate environment variables for production
 */
function validateEnvironment() {
  const required = [
    'NODE_ENV',
    'PORT'
  ];

  const recommended = [
    'DATABASE_URL',
    'JWT_SECRET',
    'WEBHOOK_SECRET'
  ];

  const missing = required.filter(env => !process.env[env]);
  const missingRecommended = recommended.filter(env => !process.env[env]);

  if (missing.length > 0) {
    console.warn('⚠️  Missing required environment variables:', missing);
    console.warn('The application may not work correctly without these variables.');
  }

  if (missingRecommended.length > 0) {
    console.warn('⚠️  Missing recommended environment variables:', missingRecommended);
    console.warn('Some features may not work without these variables.');
  }

  if (missing.length === 0 && missingRecommended.length === 0) {
    console.log('✅ Environment variables configured');
  }
}

/**
 * Set production optimizations
 */
function setProductionOptimizations() {
  // Set NODE_ENV if not already set
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }

  // Set memory optimization flags for Node.js
  const nodeOptions = process.env.NODE_OPTIONS || '';
  
  const optimizations = [
    '--max-old-space-size=1024', // Limit memory usage to 1GB
    '--gc-interval=100',         // More frequent garbage collection
    '--optimize-for-size'        // Optimize for memory usage over speed
  ];

  const newNodeOptions = optimizations
    .filter(opt => !nodeOptions.includes(opt))
    .join(' ');

  if (newNodeOptions) {
    process.env.NODE_OPTIONS = `${nodeOptions} ${newNodeOptions}`.trim();
    console.log('✅ Production optimizations applied');
  }
}

/**
 * Create production health check script
 */
function createHealthCheck() {
  const healthCheckScript = `#!/usr/bin/env node

const http = require('http');

const port = process.env.PORT || 3001;
const host = process.env.HOST || '0.0.0.0';

const options = {
  hostname: host,
  port: port,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Health check passed');
    process.exit(0);
  } else {
    console.error(\`❌ Health check failed with status \${res.statusCode}\`);
    process.exit(1);
  }
});

req.on('error', (err) => {
  console.error('❌ Health check failed:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('❌ Health check timed out');
  req.destroy();
  process.exit(1);
});

req.end();
`;

  fs.writeFileSync(
    path.join(process.cwd(), 'scripts', 'health-check.js'),
    healthCheckScript
  );

  console.log('✅ Health check script created');
}

/**
 * Create environment validation script
 */
function createEnvironmentValidator() {
  const validatorScript = `#!/usr/bin/env node

const crypto = require('crypto');

/**
 * Validate environment variables for production deployment
 */
function validateEnvironment() {
  console.log('🔍 Validating production environment...');
  
  const errors = [];
  const warnings = [];
  
  // Required variables
  const required = {
    'NODE_ENV': {
      validator: (val) => ['production', 'staging'].includes(val),
      message: 'NODE_ENV must be "production" or "staging"'
    },
    'PORT': {
      validator: (val) => !isNaN(parseInt(val)) && parseInt(val) > 0,
      message: 'PORT must be a positive number'
    }
  };
  
  // Check database configuration
  const hasDatabase = process.env.DATABASE_URL || 
    (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    
  if (!hasDatabase) {
    errors.push('Database configuration required: DATABASE_URL or (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
  }
  
  // Check JWT secret
  if (!process.env.JWT_SECRET) {
    warnings.push('JWT_SECRET not set - using default (not recommended for production)');
  } else if (process.env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters long');
  }
  
  // Check webhook secret
  if (!process.env.WEBHOOK_SECRET) {
    warnings.push('WEBHOOK_SECRET not set - webhooks will not work');
  } else if (process.env.WEBHOOK_SECRET.length < 32) {
    warnings.push('WEBHOOK_SECRET should be at least 32 characters long');
  }
  
  // Validate required variables
  Object.entries(required).forEach(([key, config]) => {
    const value = process.env[key];
    if (!value) {
      errors.push(\`\${key} is required\`);
    } else if (!config.validator(value)) {
      errors.push(\`\${key}: \${config.message}\`);
    }
  });
  
  // Display results
  if (errors.length > 0) {
    console.error('❌ Environment validation failed:');
    errors.forEach(error => console.error(\`  • \${error}\`));
    process.exit(1);
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️  Environment validation warnings:');
    warnings.forEach(warning => console.warn(\`  • \${warning}\`));
  }
  
  console.log('✅ Environment validation passed');
}

if (require.main === module) {
  validateEnvironment();
}

module.exports = { validateEnvironment };
`;

  fs.writeFileSync(
    path.join(process.cwd(), 'scripts', 'validate-environment.js'),
    validatorScript
  );

  console.log('✅ Environment validator created');
}

/**
 * Main setup function
 */
function main() {
  try {
    console.log('Starting production setup...\n');

    validateRequiredFiles();
    createDirectories();
    validateEnvironment();
    setProductionOptimizations();
    createHealthCheck();
    createEnvironmentValidator();

    console.log('\n🎉 Production setup completed successfully!');
    console.log('The application is ready for Railway deployment.');
    
    // Show deployment tips
    console.log('\n📝 Deployment Tips:');
    console.log('  • Set required environment variables in Railway dashboard');
    console.log('  • Use Railway PostgreSQL addon for database');
    console.log('  • Monitor logs after deployment');
    console.log('  • Test health endpoint: /health');

  } catch (error) {
    console.error('💥 Production setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  main();
}

module.exports = { main };