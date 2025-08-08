#!/usr/bin/env node

/**
 * Production Validation Suite
 * Comprehensive testing for Railway deployment readiness
 */

const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class ProductionValidator {
  constructor() {
    this.results = {
      passed: [],
      warnings: [],
      errors: [],
      critical: []
    };
    this.baseUrl = process.env.TEST_URL || 'http://localhost:3002';
  }

  log(type, message) {
    const timestamp = new Date().toISOString();
    const colors = {
      PASS: '\x1b[32m✅',
      WARN: '\x1b[33m⚠️',
      ERROR: '\x1b[31m❌',
      CRITICAL: '\x1b[31m💥',
      INFO: '\x1b[36mℹ️'
    };
    
    console.log(`${colors[type] || ''} [${timestamp}] ${type}: ${message}\x1b[0m`);
  }

  pass(message) {
    this.results.passed.push(message);
    this.log('PASS', message);
  }

  warn(message) {
    this.results.warnings.push(message);
    this.log('WARN', message);
  }

  error(message) {
    this.results.errors.push(message);
    this.log('ERROR', message);
  }

  critical(message) {
    this.results.critical.push(message);
    this.log('CRITICAL', message);
  }

  info(message) {
    this.log('INFO', message);
  }

  // Test 1: Environment Variables Validation
  validateEnvironmentVariables() {
    this.info('Testing environment variables...');
    
    const required = [
      'NODE_ENV',
      'PORT'
    ];

    const databaseVars = ['DATABASE_URL', 'POSTGRES_URL', 'SUPABASE_URL'];
    const hasDatabase = databaseVars.some(v => process.env[v]);

    if (!hasDatabase) {
      this.critical('No database configuration found (DATABASE_URL, POSTGRES_URL, or SUPABASE_URL)');
    } else {
      this.pass('Database configuration present');
    }

    const security = ['WEBHOOK_SECRET'];
    security.forEach(env => {
      if (!process.env[env]) {
        this.error(`Missing security variable: ${env}`);
      } else {
        this.pass(`Security variable present: ${env}`);
      }
    });

    const optional = ['RETELL_API_KEY', 'RESEND_API_KEY', 'REDIS_URL'];
    optional.forEach(env => {
      if (!process.env[env]) {
        this.warn(`Optional service not configured: ${env}`);
      } else {
        this.pass(`Service configured: ${env}`);
      }
    });

    // Validate formats
    if (process.env.WEBHOOK_SECRET && process.env.WEBHOOK_SECRET.length < 32) {
      this.error('WEBHOOK_SECRET too short (minimum 32 characters)');
    } else if (process.env.WEBHOOK_SECRET) {
      this.pass('WEBHOOK_SECRET meets security requirements');
    }

    if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.startsWith('https://')) {
      this.error('SUPABASE_URL must be HTTPS');
    } else if (process.env.SUPABASE_URL) {
      this.pass('SUPABASE_URL format valid');
    }
  }

  // Test 2: Package Dependencies
  validatePackageDependencies() {
    this.info('Validating package dependencies...');
    
    try {
      const packagePath = path.join(__dirname, 'package.json');
      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const criticalDeps = [
        'express', 
        'cors', 
        'helmet', 
        'express-rate-limit',
        'dotenv'
      ];

      criticalDeps.forEach(dep => {
        if (packageData.dependencies[dep]) {
          this.pass(`Critical dependency present: ${dep}`);
        } else {
          this.critical(`Missing critical dependency: ${dep}`);
        }
      });

      // Check for heavy/unused dependencies that could cause Railway build issues
      const heavyDeps = [
        'puppeteer',
        'puppeteer-extra',
        'sharp',
        'pdfkit'
      ];

      heavyDeps.forEach(dep => {
        if (packageData.dependencies[dep]) {
          this.warn(`Heavy dependency present: ${dep} (may slow deployment)`);
        }
      });

    } catch (error) {
      this.critical(`Failed to read package.json: ${error.message}`);
    }
  }

  // Test 3: Server Health Check
  async validateServerHealth() {
    this.info('Testing server health endpoints...');
    
    return new Promise((resolve) => {
      const healthUrl = `${this.baseUrl}/health`;
      
      const client = this.baseUrl.startsWith('https:') ? https : http;
      
      const req = client.get(healthUrl, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const health = JSON.parse(data);
            
            if (res.statusCode === 200) {
              this.pass('Health endpoint responding (200 OK)');
              
              // Validate health response structure
              const requiredFields = ['status', 'service', 'timestamp', 'uptime'];
              const missingFields = requiredFields.filter(field => !health[field]);
              
              if (missingFields.length === 0) {
                this.pass('Health response contains all required fields');
              } else {
                this.warn(`Health response missing fields: ${missingFields.join(', ')}`);
              }
              
              if (health.status === 'healthy') {
                this.pass('Service reports healthy status');
              } else {
                this.error(`Service reports status: ${health.status}`);
              }
              
            } else {
              this.error(`Health endpoint returned ${res.statusCode}: ${data}`);
            }
          } catch (parseError) {
            this.error(`Health endpoint returned invalid JSON: ${parseError.message}`);
          }
          resolve();
        });
      });

      req.on('error', (error) => {
        this.critical(`Health endpoint unreachable: ${error.message}`);
        resolve();
      });

      req.on('timeout', () => {
        req.destroy();
        this.critical('Health endpoint timeout (>10s)');
        resolve();
      });
    });
  }

  // Test 4: API Endpoints
  async validateApiEndpoints() {
    this.info('Testing API endpoints...');
    
    const endpoints = [
      { path: '/', method: 'GET', expectedStatus: 200 },
      { path: '/api/status', method: 'GET', expectedStatus: 200 },
      { path: '/nonexistent', method: 'GET', expectedStatus: 404 }
    ];

    for (const endpoint of endpoints) {
      await this.testEndpoint(endpoint);
    }
  }

  async testEndpoint({ path, method, expectedStatus }) {
    return new Promise((resolve) => {
      const url = `${this.baseUrl}${path}`;
      const client = this.baseUrl.startsWith('https:') ? https : http;
      
      const req = client.request(url, { method, timeout: 5000 }, (res) => {
        if (res.statusCode === expectedStatus) {
          this.pass(`${method} ${path} returns ${expectedStatus} as expected`);
        } else {
          this.error(`${method} ${path} returned ${res.statusCode}, expected ${expectedStatus}`);
        }
        
        // Check security headers
        const securityHeaders = [
          'x-content-type-options',
          'x-frame-options'
        ];
        
        securityHeaders.forEach(header => {
          if (res.headers[header]) {
            this.pass(`Security header present: ${header}`);
          } else {
            this.warn(`Missing security header: ${header}`);
          }
        });
        
        resolve();
      });

      req.on('error', (error) => {
        this.error(`${method} ${path} failed: ${error.message}`);
        resolve();
      });

      req.on('timeout', () => {
        req.destroy();
        this.error(`${method} ${path} timeout`);
        resolve();
      });

      req.end();
    });
  }

  // Test 5: Security Validation
  async validateSecurity() {
    this.info('Testing security measures...');
    
    // Test rate limiting
    await this.testRateLimit();
    
    // Test webhook security
    await this.testWebhookSecurity();
  }

  async testRateLimit() {
    this.info('Testing rate limiting...');
    
    const promises = Array(10).fill().map(() => this.makeRequest('/api/status'));
    
    try {
      const results = await Promise.all(promises);
      const rateLimited = results.some(result => result.status === 429);
      
      if (rateLimited) {
        this.pass('Rate limiting is working (some requests returned 429)');
      } else {
        this.warn('Rate limiting may not be working (no 429 responses in burst test)');
      }
    } catch (error) {
      this.error(`Rate limit test failed: ${error.message}`);
    }
  }

  async testWebhookSecurity() {
    this.info('Testing webhook security...');
    
    // Test webhook without signature
    const webhookData = JSON.stringify({
      searchId: 'test-security',
      newVehicles: []
    });

    return new Promise((resolve) => {
      const client = this.baseUrl.startsWith('https:') ? https : http;
      
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(webhookData)
        }
      };

      const req = client.request(`${this.baseUrl}/api/webhooks/n8n`, options, (res) => {
        if (res.statusCode === 401) {
          this.pass('Webhook endpoint properly secured (401 without signature)');
        } else if (res.statusCode === 500) {
          this.pass('Webhook endpoint requires configuration (500 - webhook secret not set)');
        } else {
          this.error(`Webhook endpoint not properly secured (status: ${res.statusCode})`);
        }
        resolve();
      });

      req.on('error', (error) => {
        this.warn(`Could not test webhook security: ${error.message}`);
        resolve();
      });

      req.write(webhookData);
      req.end();
    });
  }

  async makeRequest(path) {
    return new Promise((resolve, reject) => {
      const client = this.baseUrl.startsWith('https:') ? https : http;
      
      const req = client.get(`${this.baseUrl}${path}`, { timeout: 5000 }, (res) => {
        resolve({ status: res.statusCode, headers: res.headers });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    });
  }

  // Test 6: Performance Validation
  async validatePerformance() {
    this.info('Testing performance characteristics...');
    
    const startTime = Date.now();
    
    try {
      await this.makeRequest('/health');
      const responseTime = Date.now() - startTime;
      
      if (responseTime < 100) {
        this.pass(`Fast response time: ${responseTime}ms`);
      } else if (responseTime < 500) {
        this.warn(`Acceptable response time: ${responseTime}ms`);
      } else {
        this.error(`Slow response time: ${responseTime}ms`);
      }
      
      // Memory usage check
      const memUsage = process.memoryUsage();
      const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      if (memMB < 100) {
        this.pass(`Good memory usage: ${memMB}MB`);
      } else if (memMB < 250) {
        this.warn(`Moderate memory usage: ${memMB}MB`);
      } else {
        this.error(`High memory usage: ${memMB}MB`);
      }
      
    } catch (error) {
      this.error(`Performance test failed: ${error.message}`);
    }
  }

  // Generate comprehensive report
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 PRODUCTION VALIDATION REPORT');
    console.log('='.repeat(80));
    
    const total = this.results.passed.length + this.results.warnings.length + 
                  this.results.errors.length + this.results.critical.length;
    
    console.log(`\n📊 SUMMARY (${total} total checks)`);
    console.log(`✅ PASSED: ${this.results.passed.length}`);
    console.log(`⚠️  WARNINGS: ${this.results.warnings.length}`);
    console.log(`❌ ERRORS: ${this.results.errors.length}`);
    console.log(`💥 CRITICAL: ${this.results.critical.length}`);
    
    if (this.results.passed.length > 0) {
      console.log('\n✅ PASSED CHECKS:');
      this.results.passed.forEach(item => console.log(`   • ${item}`));
    }
    
    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.results.warnings.forEach(item => console.log(`   • ${item}`));
    }
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.results.errors.forEach(item => console.log(`   • ${item}`));
    }
    
    if (this.results.critical.length > 0) {
      console.log('\n💥 CRITICAL ISSUES:');
      this.results.critical.forEach(item => console.log(`   • ${item}`));
    }
    
    console.log('\n' + '='.repeat(80));
    
    // Deployment readiness assessment
    const isReady = this.results.critical.length === 0 && this.results.errors.length === 0;
    const hasWarnings = this.results.warnings.length > 0;
    
    if (isReady && !hasWarnings) {
      console.log('🎉 PRODUCTION READY - All systems go!');
      console.log('✅ Safe to deploy to Railway production');
      return 0;
    } else if (isReady && hasWarnings) {
      console.log('⚠️  PRODUCTION READY WITH WARNINGS');
      console.log('✅ Safe to deploy, but address warnings for optimal performance');
      return 0;
    } else if (this.results.critical.length === 0) {
      console.log('❌ NOT PRODUCTION READY - Fix errors before deployment');
      console.log('🔧 Address all errors before deploying to production');
      return 1;
    } else {
      console.log('💥 CRITICAL ISSUES FOUND - Do not deploy!');
      console.log('🚨 Fix critical issues immediately before attempting deployment');
      return 1;
    }
  }

  async runAllTests() {
    console.log('🔍 Starting Production Validation Suite...\n');
    
    // Run all validation tests
    this.validateEnvironmentVariables();
    this.validatePackageDependencies();
    await this.validateServerHealth();
    await this.validateApiEndpoints();
    await this.validateSecurity();
    await this.validatePerformance();
    
    // Generate and return report
    const exitCode = this.generateReport();
    return exitCode;
  }
}

// CLI execution
if (require.main === module) {
  const validator = new ProductionValidator();
  
  validator.runAllTests()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('💥 Validation suite crashed:', error);
      process.exit(1);
    });
}

module.exports = ProductionValidator;