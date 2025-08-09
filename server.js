#!/usr/bin/env node

/**
 * Railway Server Starter with Fallback
 */

console.log('🚂 Starting Auto-Alert Notification Service...');

try {
    // Try to start the simple Railway server first (most reliable)
    require('./simple-railway-server.js');
} catch (error) {
    console.error('❌ Simple server failed:', error.message);
    console.log('🔄 Trying main service...');
    
    try {
        require('./railway/notification-service/src/server.js');
    } catch (mainError) {
        console.error('❌ Main server also failed:', mainError.message);
        console.log('🔄 Starting basic fallback...');
        
        try {
            require('./simple-server.js');
        } catch (fallbackError) {
            console.error('❌ All servers failed:', fallbackError.message);
            process.exit(1);
        }
    }
}
