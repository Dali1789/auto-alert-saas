const express = require('express');
const DatabaseService = require('../services/DatabaseService');

const router = express.Router();

/**
 * Basic health check
 * GET /health
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Auto-Alert Notification Service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

/**
 * Detailed health check with service dependencies
 * GET /health/detailed
 */
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'Auto-Alert Notification Service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {}
  };

  // Check Database connection (PostgreSQL/Supabase)
  try {
    const dbHealth = await DatabaseService.healthCheck();
    health.services.database = dbHealth;
  } catch (error) {
    health.services.database = {
      status: 'unhealthy',
      error: error.message,
      connected: false
    };
  }

  // Get database statistics
  try {
    const stats = await DatabaseService.getStats();
    health.database_stats = stats;
  } catch (error) {
    health.database_stats = { error: error.message };
  }

  // Check Retell AI configuration
  health.services.retell = {
    status: process.env.RETELL_API_KEY ? 'configured' : 'not_configured',
    configured: !!process.env.RETELL_API_KEY
  };

  // Check Resend configuration
  health.services.resend = {
    status: process.env.RESEND_API_KEY ? 'configured' : 'not_configured',
    configured: !!process.env.RESEND_API_KEY
  };

  // Overall health status
  const unhealthyServices = Object.values(health.services)
    .filter(service => service.status === 'unhealthy' || service.status === 'not_configured');
  
  if (unhealthyServices.length > 0) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * Readiness probe for Kubernetes/Railway
 * GET /health/ready
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if all required environment variables are set
    const required = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'RETELL_API_KEY',
      'RESEND_API_KEY'
    ];

    const missing = required.filter(env => !process.env[env]);
    
    if (missing.length > 0) {
      return res.status(503).json({
        status: 'not_ready',
        missing_env: missing
      });
    }

    // Quick database connectivity check
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    await supabase.from('auto_alert_user_profiles').select('count').limit(1);

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: error.message
    });
  }
});

/**
 * Liveness probe for Kubernetes/Railway
 * GET /health/live
 */
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;