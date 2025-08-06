#!/usr/bin/env node

/**
 * Railway-compatible server starter
 * Handles environment validation and starts the notification service
 */

const path = require('path');
const fs = require('fs');

console.log('🚂 Railway Server Starter');
console.log('=' .repeat(50));

// Check if we're in the right directory structure
const serverPath = path.join(__dirname, 'railway', 'notification-service', 'src', 'server.js');
const altServerPath = path.join(__dirname, 'railway', 'notification-service', 'src', 'server.js');

console.log('🔍 Looking for server file...');
console.log(`   Checking: ${serverPath}`);

if (fs.existsSync(serverPath)) {
    console.log('✅ Server file found');
    console.log('🚀 Starting Auto-Alert Notification Service...');
    
    // Set NODE_PATH to help with module resolution
    process.env.NODE_PATH = path.join(__dirname, 'node_modules');
    require('module')._initPaths();
    
    // Start the server with absolute path
    require(serverPath);
} else {
    console.error('❌ Server file not found!');
    console.error('Expected at:', serverPath);
    console.error('');
    console.error('Available files:');
    
    // List available files for debugging
    const railwayDir = path.join(__dirname, 'railway');
    if (fs.existsSync(railwayDir)) {
        const items = fs.readdirSync(railwayDir, { recursive: true });
        items.forEach(item => {
            console.error(`   ${item}`);
        });
    } else {
        console.error('   railway/ directory not found');
    }
    
    process.exit(1);
}