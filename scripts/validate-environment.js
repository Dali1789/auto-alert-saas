#!/usr/bin/env node

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
      errors.push(`${key} is required`);
    } else if (!config.validator(value)) {
      errors.push(`${key}: ${config.message}`);
    }
  });
  
  // Display results
  if (errors.length > 0) {
    console.error('❌ Environment validation failed:');
    errors.forEach(error => console.error(`  • ${error}`));
    process.exit(1);
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️  Environment validation warnings:');
    warnings.forEach(warning => console.warn(`  • ${warning}`));
  }
  
  console.log('✅ Environment validation passed');
}

if (require.main === module) {
  validateEnvironment();
}

module.exports = { validateEnvironment };
