const crypto = require('crypto');

class EnvironmentConfig {
  constructor() {
    this.config = null;
    this.validateEnvironment();
    this.setupConfig();
  }

  validateEnvironment() {
    console.log('🔍 Validating environment configuration...');
    
    // Required environment variables
    const required = [
      'WEBHOOK_SECRET'
    ];

    // Database connection (either Supabase or PostgreSQL)
    const databaseRequired = [
      'DATABASE_URL', // PostgreSQL for Railway
      'POSTGRES_URL'  // Alternative PostgreSQL URL
    ];

    const hasDatabase = databaseRequired.some(env => process.env[env]);
    const hasSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!hasDatabase && !hasSupabase) {
      console.error('❌ No database configuration found!');
      console.error('Required: Either DATABASE_URL/POSTGRES_URL or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }

    // Optional but recommended
    const recommended = [
      'RETELL_API_KEY',
      'RESEND_API_KEY',
      'TEST_API_KEY'
    ];

    // Check required variables
    const missing = required.filter(env => !process.env[env]);
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing);
      console.error('Please check your environment configuration.');
      
      // In production, Railway should have these set
      if (process.env.NODE_ENV === 'production' && !process.env.RAILWAY_ENVIRONMENT) {
        console.error('💥 Production environment requires database configuration!');
        console.error('Set DATABASE_URL or POSTGRES_URL for PostgreSQL');
        console.error('OR set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for Supabase');
        process.exit(1);
      } else {
        console.warn('⚠️  Development mode - using fallback values');
        // Set fallback values for development
        if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = 'https://placeholder.supabase.co';
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTYwMzk2ODgzNCwiZXhwIjoxOTY5NTQ0ODM0fQ.placeholder';
        if (!process.env.WEBHOOK_SECRET) process.env.WEBHOOK_SECRET = 'development-webhook-secret-placeholder-32chars';
      }
    }

    // Check recommended variables
    const missingRecommended = recommended.filter(env => !process.env[env]);
    if (missingRecommended.length > 0) {
      console.warn('⚠️ Missing recommended environment variables:', missingRecommended);
      console.warn('Some features may not work properly.');
    }

    // Validate formats
    this.validateFormats();
    console.log('✅ Environment validation passed');
  }

  validateFormats() {
    const formatValidations = {
      SUPABASE_URL: {
        pattern: /^https:\/\/.+/,
        message: 'SUPABASE_URL must be a valid HTTPS URL'
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        pattern: /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/,
        message: 'SUPABASE_SERVICE_ROLE_KEY must be a valid JWT token'
      },
      WEBHOOK_SECRET: {
        pattern: /.{32,}/,
        message: 'WEBHOOK_SECRET must be at least 32 characters'
      },
      RETELL_API_KEY: {
        pattern: /^key_[a-zA-Z0-9_-]+$/,
        message: 'RETELL_API_KEY must start with "key_"',
        optional: true
      },
      RESEND_API_KEY: {
        pattern: /^re_[a-zA-Z0-9_-]+$/,
        message: 'RESEND_API_KEY must start with "re_"',
        optional: true
      }
    };

    for (const [key, validation] of Object.entries(formatValidations)) {
      const value = process.env[key];
      
      if (!value && validation.optional) {
        continue;
      }
      
      if (!value || !validation.pattern.test(value)) {
        if (process.env.NODE_ENV === 'production' && process.env.RAILWAY_ENVIRONMENT) {
          console.error(`❌ Invalid format for ${key}: ${validation.message}`);
          if (!validation.optional) {
            process.exit(1);
          }
        } else {
          console.warn(`⚠️  Invalid format for ${key}: ${validation.message} (ignored in development)`);
        }
      }
    }
  }

  setupConfig() {
    // Generate test API key if not provided
    const testApiKey = process.env.TEST_API_KEY || 
      crypto.randomBytes(32).toString('hex');

    if (!process.env.TEST_API_KEY) {
      console.log('🔑 Generated TEST_API_KEY:', testApiKey.substring(0, 8) + '...');
    }

    this.config = {
      server: {
        port: parseInt(process.env.PORT) || 3001,
        nodeEnv: process.env.NODE_ENV || 'development',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
      },
      database: {
        // PostgreSQL (Railway)
        databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL,
        // Supabase (fallback)
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        // Redis
        redisUrl: process.env.REDIS_URL
      },
      services: {
        retell: {
          apiKey: process.env.RETELL_API_KEY,
          agentId: process.env.RETELL_AGENT_ID,
          phoneNumber: process.env.RETELL_PHONE_NUMBER
        },
        resend: {
          apiKey: process.env.RESEND_API_KEY
        }
      },
      security: {
        webhookSecret: process.env.WEBHOOK_SECRET,
        testApiKey: testApiKey,
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 1000,
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000
      },
      features: {
        enableVoiceCalls: !!process.env.RETELL_API_KEY,
        enableEmails: !!process.env.RESEND_API_KEY,
        enableTestEndpoints: process.env.NODE_ENV !== 'production'
      }
    };

    // Log configuration status
    this.logConfigStatus();
  }

  logConfigStatus() {
    console.log('📋 Service Configuration:');
    console.log(`   Environment: ${this.config.server.nodeEnv}`);
    console.log(`   Port: ${this.config.server.port}`);
    console.log(`   Frontend URL: ${this.config.server.frontendUrl}`);
    console.log(`   Database: ${this.config.database.databaseUrl || this.config.database.supabaseUrl ? '✅ Connected' : '❌ Not configured'}`);
    console.log(`   Redis: ${this.config.database.redisUrl ? '✅ Connected' : '❌ Not configured'}`);
    console.log(`   Voice Calls: ${this.config.features.enableVoiceCalls ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Email: ${this.config.features.enableEmails ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Test Endpoints: ${this.config.features.enableTestEndpoints ? '✅ Enabled' : '❌ Disabled'}`);
  }

  getConfig() {
    return this.config;
  }

  // Secure method to get database config
  getDatabaseConfig() {
    return {
      url: this.config.database.supabaseUrl,
      serviceKey: this.config.database.supabaseServiceKey
    };
  }

  // Secure method to get service configs
  getServiceConfig(service) {
    return this.config.services[service] || {};
  }

  // Check if feature is enabled
  isFeatureEnabled(feature) {
    return this.config.features[feature] || false;
  }
}

// Export singleton instance
module.exports = new EnvironmentConfig();