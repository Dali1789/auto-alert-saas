#!/usr/bin/env node

/**
 * Railway Server Starter with Fallback
 */

console.log('🚂 Starting Auto-Alert Notification Service...');

// FORCE simple Railway server (bypasses rate limiting issues)
console.log('🚀 Using Simple Railway Server for stability...');
require('./simple-railway-server.js');
