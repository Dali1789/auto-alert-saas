#!/usr/bin/env node

/**
 * Railway Deployment Health Check
 * Tests all Auto-Alert SaaS services
 */

const { createClient } = require('@supabase/supabase-js');

async function checkSupabaseConnection() {
  console.log('🔍 Checking Supabase connection...');
  
  const supabaseUrl = process.env.SUPABASE_URL || 'https://kong-production-9e43.up.railway.app';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseKey) {
    console.log('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
    return false;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test database connection
    const { data, error } = await supabase
      .from('auto_alert_user_profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ Supabase connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connected successfully');
    return true;
  } catch (error) {
    console.log('❌ Supabase error:', error.message);
    return false;
  }
}

async function checkRequiredTables() {
  console.log('🔍 Checking required tables...');
  
  const supabaseUrl = process.env.SUPABASE_URL || 'https://kong-production-9e43.up.railway.app';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const requiredTables = [
    'auto_alert_user_profiles',
    'auto_alert_searches', 
    'auto_alert_results',
    'auto_alert_notifications'
  ];
  
  let allTablesExist = true;
  
  for (const table of requiredTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('count')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table ${table} not found:`, error.message);
        allTablesExist = false;
      } else {
        console.log(`✅ Table ${table} exists`);
      }
    } catch (error) {
      console.log(`❌ Error checking table ${table}:`, error.message);
      allTablesExist = false;
    }
  }
  
  return allTablesExist;
}

async function checkEnvironmentVariables() {
  console.log('🔍 Checking environment variables...');
  
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'RETELL_API_KEY',
    'RESEND_API_KEY',
    'WEBHOOK_SECRET'
  ];
  
  let allPresent = true;
  
  for (const envVar of required) {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar} is set`);
    } else {
      console.log(`❌ ${envVar} is missing`);
      allPresent = false;
    }
  }
  
  return allPresent;
}

async function testRetellAI() {
  console.log('🔍 Testing Retell AI connection...');
  
  if (!process.env.RETELL_API_KEY) {
    console.log('❌ RETELL_API_KEY not set');
    return false;
  }
  
  try {
    const fetch = require('node-fetch');
    const response = await fetch('https://api.retellai.com/list-voices', {
      headers: {
        'Authorization': `Bearer ${process.env.RETELL_API_KEY}`
      },
      timeout: 10000
    });
    
    if (response.ok) {
      console.log('✅ Retell AI connection successful');
      return true;
    } else {
      console.log('❌ Retell AI connection failed:', response.statusText);
      return false;
    }
  } catch (error) {
    console.log('❌ Retell AI error:', error.message);
    return false;
  }
}

async function testResend() {
  console.log('🔍 Testing Resend connection...');
  
  if (!process.env.RESEND_API_KEY) {
    console.log('❌ RESEND_API_KEY not set');
    return false;
  }
  
  try {
    const fetch = require('node-fetch');
    const response = await fetch('https://api.resend.com/domains', {
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      timeout: 10000
    });
    
    if (response.ok) {
      console.log('✅ Resend connection successful');
      return true;
    } else {
      console.log('❌ Resend connection failed:', response.statusText);
      return false;
    }
  } catch (error) {
    console.log('❌ Resend error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Auto-Alert SaaS Railway Deployment Health Check\n');
  
  const checks = [
    { name: 'Environment Variables', test: checkEnvironmentVariables },
    { name: 'Supabase Connection', test: checkSupabaseConnection },
    { name: 'Required Tables', test: checkRequiredTables },
    { name: 'Retell AI', test: testRetellAI },
    { name: 'Resend Email', test: testResend }
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    console.log(`\n=== ${check.name} ===`);
    const result = await check.test();
    if (!result) allPassed = false;
  }
  
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('🎉 ALL CHECKS PASSED! Auto-Alert SaaS is ready to deploy!');
    process.exit(0);
  } else {
    console.log('❌ Some checks failed. Please fix the issues above.');
    console.log('\n📋 Quick fixes:');
    console.log('1. Run railway/setup-database.sql in Railway PostgreSQL');
    console.log('2. Set missing environment variables in Railway');
    console.log('3. Check API keys are valid');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  checkSupabaseConnection,
  checkRequiredTables,
  checkEnvironmentVariables,
  testRetellAI,
  testResend
};
