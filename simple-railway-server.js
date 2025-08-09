#!/usr/bin/env node

/**
 * Ultra-Simple Railway Server
 * Minimal configuration to ensure deployment works
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('🚂 Starting Simple Railway Server...');
console.log('✅ Environment:', process.env.NODE_ENV || 'development');
console.log('✅ Port:', PORT);

// Trust Railway proxy - THIS FIXES THE RATE LIMITING ERROR
app.set('trust proxy', true);

// Enable CORS with specific origins
app.use(cors({
  origin: [
    'https://auto-alert.vercel.app',
    'https://auto-alert-frontend.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Auto-Alert SaaS (Simple Mode)',
    version: '2.2.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    webhook_secret: process.env.WEBHOOK_SECRET ? 'configured' : 'not configured',
    jwt_secret: process.env.JWT_SECRET ? 'configured' : 'not configured'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Auto-Alert SaaS API',
    version: '2.1.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api/*'
    },
    docs: 'https://github.com/Dali1789/auto-alert-saas'
  });
});

// Basic API endpoint
app.get('/api/status', (req, res) => {
  res.json({
    api_status: 'operational',
    database_connected: !!process.env.DATABASE_URL,
    services: {
      webhooks: !!process.env.WEBHOOK_SECRET,
      authentication: !!process.env.JWT_SECRET,
      email: !!process.env.RESEND_API_KEY,
      voice: !!process.env.RETELL_API_KEY
    },
    timestamp: new Date().toISOString()
  });
});

// Mobile.de Search Route
app.post('/api/search/mobile-de', express.json(), async (req, res) => {
  try {
    // Mock response for now - real scraper can be added later
    const { make, model, priceFrom, priceTo, yearFrom, yearTo } = req.body;
    
    res.json({
      success: true,
      search_params: { make, model, priceFrom, priceTo, yearFrom, yearTo },
      results: [],
      total: 0,
      message: 'Mobile.de scraper endpoint ready - implementation pending'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Scraper error',
      message: error.message
    });
  }
});

// Catch all 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    requested: req.originalUrl,
    available: ['/', '/health', '/api/status', '/api/search/mobile-de']
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Simple Railway Server Started Successfully!');
  console.log('==================================================');
  console.log(`📡 Server listening on http://0.0.0.0:${PORT}`);
  console.log('🔗 Health check: /health');
  console.log('📊 API status: /api/status');
  console.log('==================================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

module.exports = app;