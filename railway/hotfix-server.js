/**
 * EMERGENCY HOTFIX SERVER
 * Minimal server that should work on Railway
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Load environment variables first
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Emergency health check that never fails
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Auto-Alert Emergency Service',
    timestamp: new Date().toISOString(),
    port: PORT,
    node_env: process.env.NODE_ENV || 'development'
  });
});

// Basic health check without database
app.get('/health/basic', (req, res) => {
  res.json({
    status: 'alive',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0-emergency'
  });
});

// Environment check endpoint
app.get('/health/env', (req, res) => {
  const envCheck = {
    NODE_ENV: !!process.env.NODE_ENV,
    PORT: !!process.env.PORT,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    RETELL_API_KEY: !!process.env.RETELL_API_KEY,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    WEBHOOK_SECRET: !!process.env.WEBHOOK_SECRET
  };

  const missingVars = Object.entries(envCheck)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  res.json({
    status: missingVars.length === 0 ? 'configured' : 'incomplete',
    environment_variables: envCheck,
    missing: missingVars
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Auto-Alert Emergency Service',
    status: 'running',
    message: 'Emergency server is operational',
    endpoints: {
      '/health': 'Basic health check',
      '/health/basic': 'Server health without dependencies',
      '/health/env': 'Environment variables check',
      '/api/status': 'Service status'
    }
  });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    service: 'Auto-Alert SaaS',
    version: '1.0.0-emergency',
    status: 'emergency_mode',
    timestamp: new Date().toISOString(),
    features: {
      notifications: 'disabled',
      webhooks: 'disabled', 
      database: 'checking'
    }
  });
});

// Catch all 404s
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    available_endpoints: ['/', '/health', '/health/basic', '/health/env', '/api/status']
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Emergency server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Emergency server encountered an error',
    timestamp: new Date().toISOString()
  });
});

// Start server with error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚨 EMERGENCY SERVER STARTED');
  console.log(`🌍 Port: ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('🔗 Health Check: /health');
  console.log('📊 Status: /api/status');
  console.log('⚙️  Environment Check: /health/env');
});

server.on('error', (error) => {
  console.error('🚨 SERVER ERROR:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔴 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('🔴 Emergency server closed');
    process.exit(0);
  });
});

module.exports = app;