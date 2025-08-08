#!/usr/bin/env node

/**
 * Railway Deployment Trigger
 * Creates a dummy change to trigger deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🚂 Railway Deployment Trigger');
console.log('Creating deployment trigger...');

// Update server.js with a timestamp comment to trigger deployment
const serverPath = './server.js';
const currentContent = fs.readFileSync(serverPath, 'utf8');

// Add timestamp comment at the end
const timestamp = new Date().toISOString();
const updatedContent = currentContent + `\n// Deployment trigger: ${timestamp}\n`;

fs.writeFileSync(serverPath, updatedContent);
console.log(`✅ Added deployment trigger at ${timestamp}`);

// Also create a deployment flag file
fs.writeFileSync('.railway-deploy-flag', JSON.stringify({
    deploymentTrigger: true,
    timestamp: timestamp,
    status: 'ready',
    packageLockFixed: true
}, null, 2));

console.log('🚀 Deployment trigger ready - commit and push to deploy');