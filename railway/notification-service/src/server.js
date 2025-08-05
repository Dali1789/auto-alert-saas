const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const notificationRoutes = require('./routes/notifications');
const webhookRoutes = require('./routes/webhooks');
const healthRoutes = require('./routes/health');

const app = express();
// Environment validation
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  }
}

const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', healthRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/webhooks', webhookRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Auto-Alert Notification Service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      notifications: '/api/notifications',
      webhooks: '/api/webhooks'
    },
    features: [
      'Voice calls via Retell AI',
      'Email notifications via Resend',
      'SMS alerts',
      'Webhook processing'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Auto-Alert Notification Service running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📞 Retell AI: ${process.env.RETELL_API_KEY ? '✅ Connected' : '❌ Not configured'}`);
  console.log(`📧 Resend: ${process.env.RESEND_API_KEY ? '✅ Connected' : '❌ Not configured'}`);
  console.log(`🗄️ Supabase: ${process.env.SUPABASE_URL ? '✅ Connected' : '❌ Not configured'}`);
});

module.exports = app;