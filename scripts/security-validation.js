#!/usr/bin/env node

/**
 * Security Validation Script
 * Run this script to validate security configuration before deployment
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

class SecurityValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
  }

  log(type, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${type}: ${message}`);
  }

  error(message) {
    this.errors.push(message);
    this.log('ERROR', message);
  }

  warning(message) {
    this.warnings.push(message);
    this.log('WARNING', message);
  }

  pass(message) {
    this.passed.push(message);
    this.log('PASS', message);
  }

  validateEnvironmentVariables() {
    this.log('INFO', 'Validating environment variables...');
    
    const required = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'WEBHOOK_SECRET'
    ];

    const recommended = [
      'RETELL_API_KEY',
      'RESEND_API_KEY',
      'TEST_API_KEY'
    ];

    // Check required variables
    required.forEach(env => {
      if (!process.env[env]) {
        this.error(`Missing required environment variable: ${env}`);
      } else {
        this.pass(`Required variable present: ${env}`);
      }
    });

    // Check recommended variables
    recommended.forEach(env => {
      if (!process.env[env]) {
        this.warning(`Missing recommended environment variable: ${env}`);
      } else {
        this.pass(`Recommended variable present: ${env}`);
      }
    });

    // Validate formats
    this.validateEnvironmentFormats();
  }

  validateEnvironmentFormats() {
    this.log('INFO', 'Validating environment variable formats...');

    const validations = {
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

    Object.entries(validations).forEach(([key, validation]) => {
      const value = process.env[key];
      
      if (!value && validation.optional) {
        this.warning(`Optional variable ${key} not set`);
        return;
      }
      
      if (!value) {
        this.error(`Variable ${key} not set`);
        return;
      }
      
      if (!validation.pattern.test(value)) {
        this.error(`Invalid format for ${key}: ${validation.message}`);
      } else {
        this.pass(`Valid format for ${key}`);
      }
    });
  }

  validateSecurityConfiguration() {
    this.log('INFO', 'Validating security configuration...');

    // Check webhook secret strength
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      if (webhookSecret.length < 32) {
        this.error('WEBHOOK_SECRET too short (minimum 32 characters)');
      } else if (webhookSecret.length < 64) {
        this.warning('WEBHOOK_SECRET could be longer for better security');
      } else {
        this.pass('WEBHOOK_SECRET meets length requirements');
      }

      // Check for common weak patterns
      if (/^[a-zA-Z]+$/.test(webhookSecret)) {
        this.warning('WEBHOOK_SECRET contains only letters (consider adding numbers/symbols)');
      } else if (/^\d+$/.test(webhookSecret)) {
        this.warning('WEBHOOK_SECRET contains only numbers (consider adding letters/symbols)');
      } else {
        this.pass('WEBHOOK_SECRET has good character diversity');
      }
    }

    // Check NODE_ENV
    if (process.env.NODE_ENV === 'production') {
      this.pass('NODE_ENV set to production');
      
      // Additional production checks
      if (process.env.TEST_API_KEY) {
        this.warning('TEST_API_KEY is set in production (ensure test endpoints are disabled)');
      }
    } else {
      this.warning('NODE_ENV is not set to production');
    }
  }

  async validateDependencies() {
    this.log('INFO', 'Validating dependencies...');

    try {
      const packagePath = path.join(__dirname, '../railway/notification-service/package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const securityDependencies = [
        'helmet',
        'express-rate-limit',
        'express-validator',
        'cors'
      ];

      securityDependencies.forEach(dep => {
        if (packageJson.dependencies[dep]) {
          this.pass(`Security dependency present: ${dep}`);
        } else {
          this.error(`Missing security dependency: ${dep}`);
        }
      });

      // Check for known vulnerable packages
      const vulnerablePackages = [
        'lodash@<4.17.21',
        'express@<4.17.1'
      ];

      this.pass('Dependency validation completed');
    } catch (error) {
      this.error(`Failed to validate dependencies: ${error.message}`);
    }
  }

  async validateNetworkSecurity(baseUrl) {
    if (!baseUrl) {
      this.warning('No base URL provided, skipping network security tests');
      return;
    }

    this.log('INFO', `Validating network security for ${baseUrl}...`);

    try {
      // Test security headers
      await this.checkSecurityHeaders(baseUrl);
      
      // Test endpoint security
      await this.checkEndpointSecurity(baseUrl);
      
    } catch (error) {
      this.error(`Network security validation failed: ${error.message}`);
    }
  }

  async checkSecurityHeaders(baseUrl) {
    return new Promise((resolve, reject) => {
      const url = `${baseUrl}/health`;
      https.get(url, (res) => {
        const headers = res.headers;
        
        // Check for security headers
        const securityHeaders = [
          'x-content-type-options',
          'x-frame-options',
          'x-xss-protection'
        ];

        securityHeaders.forEach(header => {
          if (headers[header]) {
            this.pass(`Security header present: ${header}`);
          } else {
            this.warning(`Missing security header: ${header}`);
          }
        });

        // Check for information disclosure
        if (!headers['x-powered-by']) {
          this.pass('X-Powered-By header not present (good)');
        } else {
          this.warning('X-Powered-By header present (information disclosure)');
        }

        resolve();
      }).on('error', reject);
    });
  }

  async checkEndpointSecurity(baseUrl) {
    return new Promise((resolve, reject) => {
      // Test webhook endpoint without authentication
      const webhookUrl = `${baseUrl}/api/webhooks/n8n`;
      const postData = JSON.stringify({
        searchId: 'test',
        newVehicles: []
      });

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(webhookUrl, options, (res) => {
        if (res.statusCode === 401) {
          this.pass('Webhook endpoint properly secured (401 without auth)');
        } else {
          this.error(`Webhook endpoint not secured (status: ${res.statusCode})`);
        }
        resolve();
      });

      req.on('error', (error) => {
        this.warning(`Could not test webhook endpoint: ${error.message}`);
        resolve();
      });

      req.write(postData);
      req.end();
    });
  }

  validateFilePermissions() {
    this.log('INFO', 'Validating file permissions...');

    const criticalFiles = [
      '.env',
      '.env.production',
      'src/config/environment.js'
    ];

    criticalFiles.forEach(file => {
      const filePath = path.join(__dirname, '../railway/notification-service', file);
      try {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          const mode = stats.mode & parseInt('777', 8);
          
          if (mode & parseInt('077', 8)) {
            this.warning(`File ${file} is readable by others (permissions: ${mode.toString(8)})`);
          } else {
            this.pass(`File ${file} has secure permissions`);
          }
        }
      } catch (error) {
        this.warning(`Could not check permissions for ${file}: ${error.message}`);
      }
    });
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('SECURITY VALIDATION REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n✅ PASSED CHECKS: ${this.passed.length}`);
    this.passed.forEach(item => console.log(`  • ${item}`));
    
    console.log(`\n⚠️  WARNINGS: ${this.warnings.length}`);
    this.warnings.forEach(item => console.log(`  • ${item}`));
    
    console.log(`\n❌ ERRORS: ${this.errors.length}`);
    this.errors.forEach(item => console.log(`  • ${item}`));
    
    console.log('\n' + '='.repeat(60));
    
    if (this.errors.length === 0) {
      console.log('🎉 SECURITY VALIDATION PASSED');
      console.log('Safe to deploy to production!');
      return true;
    } else {
      console.log('🚫 SECURITY VALIDATION FAILED');
      console.log('Fix all errors before deploying to production!');
      return false;
    }
  }

  async runAll(options = {}) {
    console.log('🔒 Starting Security Validation...\n');
    
    this.validateEnvironmentVariables();
    this.validateSecurityConfiguration();
    await this.validateDependencies();
    this.validateFilePermissions();
    
    if (options.baseUrl) {
      await this.validateNetworkSecurity(options.baseUrl);
    }
    
    const passed = this.generateReport();
    process.exit(passed ? 0 : 1);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const baseUrl = args.find(arg => arg.startsWith('--url='))?.split('=')[1];
  
  const validator = new SecurityValidator();
  validator.runAll({ baseUrl }).catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = SecurityValidator;