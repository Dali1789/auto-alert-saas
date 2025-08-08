#!/usr/bin/env node

/**
 * Railway Server Starter with Fallback
 */

console.log('🚂 Starting Auto-Alert Notification Service...');

try {
    // Try to start the main service
    require('./railway/notification-service/src/server.js');
} catch (error) {
    console.error('❌ Main server failed:', error.message);
    console.log('🔄 Starting simple health server as fallback...');
    
    try {
        require('./simple-server.js');
    } catch (fallbackError) {
        console.error('❌ Fallback server also failed:', fallbackError.message);
        process.exit(1);
    }
}
