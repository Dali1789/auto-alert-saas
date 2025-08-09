#!/usr/bin/env node

/**
 * Railway Server Starter with Fallback
 */

console.log('🚂 Starting Auto-Alert Notification Service...');

// FORCE simple Railway server (bypasses rate limiting issues)
console.log('🚀 Using Simple Railway Server for stability...');
require('./simple-railway-server.js');

// Deployment trigger: 2025-08-09T16:54:46.826Z
