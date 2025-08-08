const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// Import configuration and middleware
const config = require('./config/environment');
const { securityHeaders, additionalSecurity, csrfProtection } = require('./middleware/security');
const { globalLimiter, webhookLimiter, notificationLimiter, healthLimiter } = require('./middleware/rateLimiting');

// Import routes
const { router: authRoutes } = require('./routes/auth');
const alertRoutes = require('./routes/alerts');
const { router: subscriptionRoutes, checkSubscriptionLimits } = require('./routes/subscriptions');
const { router: realtimeRoutes } = require('./routes/realtime');
const notificationRoutes = require('./routes/notifications');
const webhookRoutes = require('./routes/webhooks');
const healthRoutes = require('./routes/health');

// Import Mobile.de scraper routes
const searchRoutes = require('../../../src/routes/search');
const { 
  createScraperRateLimit,
  validateSearchParams,
  monitorScraperUsage,
  checkRobotsCompliance,
  antibotProtection,
  addSecurityHeaders
} = require('../../../src/middleware/scraper-security');

const app = express();
const appConfig = config.getConfig();
const PORT = appConfig.server.port;

// Security middleware (order matters!)
app.use(securityHeaders);
app.use(additionalSecurity);

// CORS configuration
app.use(cors({
  origin: [
    appConfig.server.frontendUrl,
    'https://auto-alert.vercel.app',
    'http://localhost:3000' // Development
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Webhook-Signature']
}));

// Global rate limiting
app.use(globalLimiter);

// CSRF protection for state-changing operations
app.use(csrfProtection);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes with specific rate limiting
app.use('/health', healthLimiter, healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/alerts', checkSubscriptionLimits, alertRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/notifications', notificationLimiter, notificationRoutes);
app.use('/api/webhooks', webhookLimiter, webhookRoutes);

// Mobile.de scraper routes with security
app.use('/api/search', 
  createScraperRateLimit(),
  addSecurityHeaders,
  antibotProtection,
  checkRobotsCompliance,
  validateSearchParams,
  monitorScraperUsage,
  searchRoutes
);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Auto-Alert Notification Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      alerts: '/api/alerts',
      subscriptions: '/api/subscriptions',
      notifications: '/api/notifications',
      webhooks: '/api/webhooks',
      search: '/api/search'
    },
    features: [
      'Voice calls via Retell AI',
      'Email notifications via Resend',
      'SMS alerts',
      'Webhook processing',
      'Mobile.de vehicle scraping',
      'Real-time search alerts',
      'Background monitoring jobs'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Log error securely (don't log sensitive data)
  const errorId = require('crypto').randomBytes(8).toString('hex');
  console.error(`Error ${errorId}:`, {
    message: err.message,
    stack: appConfig.server.nodeEnv === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Send sanitized error response
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : err.message,
    errorId: errorId,
    ...(appConfig.server.nodeEnv === 'development' && {
      details: err.message,
      stack: err.stack
    })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('📱 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📱 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Auto-Alert Notification Service Started');
  console.log('=' .repeat(50));
  // Configuration is already logged by environment config
  console.log('=' .repeat(50));
  console.log(`📡 Server listening on http://0.0.0.0:${PORT}`);
  console.log('🔒 Security features enabled');
  console.log('⚡ Ready to accept requests');
});

module.exports = app;