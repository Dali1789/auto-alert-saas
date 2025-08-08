#!/usr/bin/env node

/**
 * Simple Railway Server Starter
 * Direct import without path manipulation
 */

console.log('🚂 Starting Auto-Alert Notification Service...');

try {
    // Directly require the server file
    require('./railway/notification-service/src/server.js');
} catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}
// Deployment trigger: 2025-08-08T08:17:47.571Z
