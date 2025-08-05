#!/usr/bin/env node

/**
 * AUTO-ALERT RAILWAY DEPLOYMENT VALIDATION SCRIPT
 * 
 * This script comprehensively tests the deployed Railway service
 * to ensure all components are working correctly.
 * 
 * Usage:
 *   node validation-script.js https://your-service.railway.app
 * 
 * Author: Solution Architect Agent 4
 * Version: 1.0.0
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

class AutoAlertValidator {
  constructor(serviceUrl) {
    this.baseUrl = serviceUrl.replace(/\/$/, ''); // Remove trailing slash
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
  }

  /**
   * Add test result
   */
  addResult(name, status, message, details = null) {
    const result = {
      name,
      status, // 'PASS', 'FAIL', 'WARN'
      message,
      details,
      timestamp: new Date().toISOString()
    };

    this.results.tests.push(result);
    
    if (status === 'PASS') this.results.passed++;
    else if (status === 'FAIL') this.results.failed++;
    else if (status === 'WARN') this.results.warnings++;

    // Console output with colors
    const colors = {
      PASS: '\x1b[32m', // Green
      FAIL: '\x1b[31m', // Red
      WARN: '\x1b[33m', // Yellow
      RESET: '\x1b[0m'
    };

    console.log(`${colors[status]}[${status}]${colors.RESET} ${name}: ${message}`);
    if (details && typeof details === 'object') {
      console.log(`      ${JSON.stringify(details, null, 2).replace(/\n/g, '\n      ')}`);
    }
  }

  /**
   * Test basic connectivity
   */
  async testBasicConnectivity() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 10000
      });

      if (response.status === 200) {
        this.addResult(
          'Basic Connectivity',
          'PASS',
          'Service is accessible and responding',
          { status: response.status, uptime: response.data.uptime }
        );
        return true;
      } else {
        this.addResult(
          'Basic Connectivity',
          'FAIL',
          `Unexpected status code: ${response.status}`,
          response.data
        );
        return false;
      }
    } catch (error) {
      this.addResult(
        'Basic Connectivity',
        'FAIL',
        `Cannot connect to service: ${error.message}`,
        { url: `${this.baseUrl}/health` }
      );
      return false;
    }
  }

  /**
   * Test detailed health check
   */
  async testDetailedHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/health/detailed`, {
        timeout: 15000
      });

      if (response.status === 200) {
        const health = response.data;
        
        // Check overall status
        if (health.status === 'healthy') {
          this.addResult(
            'Detailed Health Check',
            'PASS',
            'All services are healthy'
          );
        } else {
          this.addResult(
            'Detailed Health Check',
            'WARN',
            `Service status: ${health.status}`,
            health.services
          );
        }

        // Check individual services
        const services = health.services || {};
        
        // Supabase check
        if (services.supabase?.status === 'healthy') {
          this.addResult(
            'Supabase Connection',
            'PASS',
            'Database connection is healthy'
          );
        } else {
          this.addResult(
            'Supabase Connection',
            'FAIL',
            'Database connection failed',
            services.supabase
          );
        }

        // Retell AI check
        if (services.retell?.configured) {
          this.addResult(
            'Retell AI Configuration',
            'PASS',
            'Retell AI is configured'
          );
        } else {
          this.addResult(
            'Retell AI Configuration',
            'FAIL',
            'Retell AI is not configured'
          );
        }

        // Resend check
        if (services.resend?.configured) {
          this.addResult(
            'Resend Configuration',
            'PASS',
            'Resend email service is configured'
          );
        } else {
          this.addResult(
            'Resend Configuration',
            'FAIL',
            'Resend email service is not configured'
          );
        }

        return health.status === 'healthy';
      } else {
        this.addResult(
          'Detailed Health Check',
          'FAIL',
          `Health check failed with status: ${response.status}`
        );
        return false;
      }
    } catch (error) {
      this.addResult(
        'Detailed Health Check',
        'FAIL',
        `Health check request failed: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Test readiness probe
   */
  async testReadiness() {
    try {
      const response = await axios.get(`${this.baseUrl}/health/ready`, {
        timeout: 10000
      });

      if (response.status === 200 && response.data.status === 'ready') {
        this.addResult(
          'Readiness Probe',
          'PASS',
          'Service is ready to accept traffic'
        );
        return true;
      } else {
        this.addResult(
          'Readiness Probe',
          'FAIL',
          'Service is not ready',
          response.data
        );
        return false;
      }
    } catch (error) {
      this.addResult(
        'Readiness Probe',
        'FAIL',
        `Readiness check failed: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Test API endpoints
   */
  async testApiEndpoints() {
    // Test root endpoint
    try {
      const response = await axios.get(`${this.baseUrl}/`);
      
      if (response.status === 200 && response.data.service) {
        this.addResult(
          'Root API Endpoint',
          'PASS',
          'Root endpoint returns service information',
          { service: response.data.service, version: response.data.version }
        );
      } else {
        this.addResult(
          'Root API Endpoint',
          'WARN',
          'Root endpoint responds but format unexpected',
          response.data
        );
      }
    } catch (error) {
      this.addResult(
        'Root API Endpoint',
        'FAIL',
        `Root endpoint failed: ${error.message}`
      );
    }

    // Test webhook endpoint
    try {
      const testPayload = {
        testEmail: 'validator@autoalert.com',
        source: 'validation-script'
      };

      const response = await axios.post(`${this.baseUrl}/api/webhooks/test`, testPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      if (response.status === 200) {
        this.addResult(
          'Webhook Endpoint',
          'PASS',
          'Test webhook processed successfully'
        );
      } else {
        this.addResult(
          'Webhook Endpoint',
          'WARN',
          `Webhook returned status: ${response.status}`,
          response.data
        );
      }
    } catch (error) {
      this.addResult(
        'Webhook Endpoint',
        'FAIL',
        `Webhook test failed: ${error.message}`
      );
    }
  }

  /**
   * Test database schema
   */
  async testDatabaseSchema() {
    try {
      // This would require actual database credentials
      // For now, we rely on the health check endpoint
      
      const response = await axios.get(`${this.baseUrl}/health/detailed`);
      const services = response.data.services || {};
      
      if (services.supabase && services.supabase.connected) {
        this.addResult(
          'Database Schema',
          'PASS',
          'Database tables are accessible via health check'
        );
        
        // Additional table check could be added here if we expose an endpoint
        this.addResult(
          'Database Tables',
          'WARN',
          'Table structure validation requires direct database access',
          { 
            suggestion: 'Run SQL query to verify 4 tables exist',
            query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'auto_alert_%'"
          }
        );
      } else {
        this.addResult(
          'Database Schema',
          'FAIL',
          'Database connection failed, cannot verify schema'
        );
      }
    } catch (error) {
      this.addResult(
        'Database Schema',
        'FAIL',
        `Database schema check failed: ${error.message}`
      );
    }
  }

  /**
   * Test environment configuration
   */
  async testEnvironmentConfig() {
    try {
      const response = await axios.get(`${this.baseUrl}/health/detailed`);
      const services = response.data.services || {};
      
      const requiredServices = ['supabase', 'retell', 'resend'];
      let configuredCount = 0;
      
      for (const service of requiredServices) {
        if (services[service] && (services[service].configured || services[service].connected)) {
          configuredCount++;
        }
      }
      
      if (configuredCount === requiredServices.length) {
        this.addResult(
          'Environment Configuration',
          'PASS',
          'All required environment variables are configured'
        );
      } else {
        this.addResult(
          'Environment Configuration',
          'WARN',
          `${configuredCount}/${requiredServices.length} services configured`,
          services
        );
      }
    } catch (error) {
      this.addResult(
        'Environment Configuration',
        'FAIL',
        `Cannot verify environment configuration: ${error.message}`
      );
    }
  }

  /**
   * Test error handling
   */
  async testErrorHandling() {
    // Test 404 handling
    try {
      await axios.get(`${this.baseUrl}/nonexistent-endpoint`);
      this.addResult(
        'Error Handling (404)',
        'FAIL',
        'Should return 404 for nonexistent endpoints'
      );
    } catch (error) {
      if (error.response && error.response.status === 404) {
        this.addResult(
          'Error Handling (404)',
          'PASS',
          'Correctly returns 404 for nonexistent endpoints'
        );
      } else {
        this.addResult(
          'Error Handling (404)',
          'WARN',
          `Unexpected error response: ${error.message}`
        );
      }
    }

    // Test malformed request handling
    try {
      await axios.post(`${this.baseUrl}/api/webhooks/test`, 'invalid-json', {
        headers: { 'Content-Type': 'application/json' }
      });
      this.addResult(
        'Error Handling (Malformed)',
        'FAIL',
        'Should reject malformed JSON'
      );
    } catch (error) {
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
        this.addResult(
          'Error Handling (Malformed)',
          'PASS',
          'Correctly rejects malformed requests'
        );
      } else {
        this.addResult(
          'Error Handling (Malformed)',
          'WARN',
          `Unexpected error handling: ${error.message}`
        );
      }
    }
  }

  /**
   * Run all validation tests
   */
  async runAllTests() {
    console.log('🚀 Starting Auto-Alert Service Validation...\n');
    console.log(`Testing service at: ${this.baseUrl}\n`);
    
    const startTime = Date.now();

    // Run tests in order
    console.log('📡 Testing Basic Connectivity...');
    const isConnected = await this.testBasicConnectivity();
    
    if (isConnected) {
      console.log('\n🏥 Testing Health Checks...');
      await this.testDetailedHealth();
      await this.testReadiness();
      
      console.log('\n🔌 Testing API Endpoints...');
      await this.testApiEndpoints();
      
      console.log('\n🗄️ Testing Database...');
      await this.testDatabaseSchema();
      
      console.log('\n⚙️ Testing Configuration...');
      await this.testEnvironmentConfig();
      
      console.log('\n🛡️ Testing Error Handling...');
      await this.testErrorHandling();
    } else {
      console.log('\n❌ Skipping other tests due to connectivity failure');
    }
    
    const duration = Date.now() - startTime;
    
    // Print summary
    this.printSummary(duration);
    
    return this.results;
  }

  /**
   * Print validation summary
   */
  printSummary(duration) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⚠️  Warnings: ${this.results.warnings}`);
    console.log(`📝 Total Tests: ${this.results.tests.length}`);
    
    const successRate = Math.round((this.results.passed / this.results.tests.length) * 100);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    // Overall status
    console.log('\n📋 OVERALL STATUS:');
    if (this.results.failed === 0) {
      console.log('🎉 \x1b[32mDEPLOYMENT SUCCESSFUL\x1b[0m - Service is ready for production!');
    } else if (this.results.failed <= 2 && this.results.passed >= 5) {
      console.log('⚠️  \x1b[33mDEPLOYMENT PARTIAL\x1b[0m - Service is functional but needs attention');
    } else {
      console.log('❌ \x1b[31mDEPLOYMENT FAILED\x1b[0m - Critical issues need to be resolved');
    }
    
    // Next steps
    console.log('\n🚀 NEXT STEPS:');
    if (this.results.failed === 0) {
      console.log('1. Configure n8n webhook URL');
      console.log('2. Deploy frontend to Vercel');
      console.log('3. Test complete end-to-end flow');
      console.log('4. Set up monitoring and alerts');
    } else {
      console.log('1. Review failed tests above');
      console.log('2. Check Railway service logs');
      console.log('3. Verify environment variables');
      console.log('4. Re-run validation after fixes');
    }
    
    console.log('\n📋 Failed Tests:');
    const failedTests = this.results.tests.filter(t => t.status === 'FAIL');
    if (failedTests.length === 0) {
      console.log('   None! 🎉');
    } else {
      failedTests.forEach(test => {
        console.log(`   - ${test.name}: ${test.message}`);
      });
    }
  }
}

// Main execution
async function main() {
  const serviceUrl = process.argv[2];
  
  if (!serviceUrl) {
    console.error('❌ Error: Please provide the Railway service URL');
    console.error('Usage: node validation-script.js https://your-service.railway.app');
    process.exit(1);
  }

  const validator = new AutoAlertValidator(serviceUrl);
  const results = await validator.runAllTests();
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = AutoAlertValidator;