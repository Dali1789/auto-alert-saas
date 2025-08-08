#!/usr/bin/env node

/**
 * Simple Health Check Server for Railway Debugging
 */

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

console.log('🚀 Starting Simple Health Server...');
console.log('Environment Variables:');
console.log('- PORT:', PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'MISSING');
console.log('- SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'MISSING');

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Auto-Alert Simple Health Server',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        port: PORT
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'Auto-Alert SaaS - Simple Server Running',
        health: '/health',
        status: 'ok'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Simple Health Server running on http://0.0.0.0:${PORT}`);
    console.log(`🔍 Health check: http://0.0.0.0:${PORT}/health`);
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});