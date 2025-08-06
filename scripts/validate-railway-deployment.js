#!/usr/bin/env node

/**
 * Railway Deployment Validation Script
 * Tests the deployed Auto-Alert SaaS service endpoints
 */

const https = require('https');

// Get service URL from command line or use placeholder
const serviceUrl = process.argv[2] || 'https://your-service.railway.app';

console.log('🔍 Validating Railway Deployment...');
console.log(`📍 Service URL: ${serviceUrl}\n`);

// Test health endpoint
function testHealthEndpoint() {
  return new Promise((resolve, reject) => {
    console.log('Testing /health endpoint...');
    
    https.get(`${serviceUrl}/health`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Health check passed!');
          console.log(`   Response: ${data}`);
          resolve(true);
        } else {
          console.log(`❌ Health check failed! Status: ${res.statusCode}`);
          console.log(`   Response: ${data}`);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.log('❌ Health check error:', err.message);
      resolve(false);
    });
  });
}

// Test detailed health endpoint
function testDetailedHealthEndpoint() {
  return new Promise((resolve, reject) => {
    console.log('\nTesting /health/detailed endpoint...');
    
    https.get(`${serviceUrl}/health/detailed`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Detailed health check passed!');
          try {
            const health = JSON.parse(data);
            console.log('   Database:', health.services?.database?.status || 'unknown');
            console.log('   Retell AI:', health.services?.retellAI?.status || 'unknown');
            console.log('   Resend:', health.services?.resend?.status || 'unknown');
          } catch (e) {
            console.log('   Response:', data);
          }
          resolve(true);
        } else {
          console.log(`❌ Detailed health check failed! Status: ${res.statusCode}`);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.log('❌ Detailed health check error:', err.message);
      resolve(false);
    });
  });
}

// Run all tests
async function runValidation() {
  const results = {
    health: await testHealthEndpoint(),
    detailedHealth: await testDetailedHealthEndpoint()
  };
  
  console.log('\n📊 Validation Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Health Check: ${results.health ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Detailed Health: ${results.detailedHealth ? '✅ PASSED' : '❌ FAILED'}`);
  
  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    console.log('\n🎉 All validation checks passed! Your deployment is ready!');
  } else {
    console.log('\n⚠️  Some checks failed. Please review the deployment.');
    console.log('\nTroubleshooting tips:');
    console.log('1. Check Railway logs for errors');
    console.log('2. Verify all environment variables are set');
    console.log('3. Ensure the service has a public domain enabled');
    console.log('4. Check database connectivity');
  }
}

// Show usage if no URL provided
if (serviceUrl === 'https://your-service.railway.app') {
  console.log('\n⚠️  No service URL provided!');
  console.log('Usage: node validate-railway-deployment.js <your-railway-url>');
  console.log('Example: node validate-railway-deployment.js https://auto-alert-prod.railway.app');
  console.log('\nProceeding with placeholder URL for demonstration...\n');
}

runValidation().catch(console.error);