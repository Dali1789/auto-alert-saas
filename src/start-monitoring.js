#!/usr/bin/env node

/**
 * Startup script for Mobile.de monitoring jobs
 * Initializes and starts background monitoring for vehicle alerts
 */

const { monitoringJobManager } = require('./jobs/monitoring');
const winston = require('winston');
const path = require('path');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level}]: ${message}${
        Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
      }`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/monitoring-startup.log') 
    })
  ]
});

async function startMonitoring() {
  try {
    logger.info('🚀 Starting Mobile.de monitoring service...');
    
    // Check environment variables
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
      'DATABASE_URL'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    logger.info('✅ Environment variables validated');
    
    // Initialize monitoring job manager
    await monitoringJobManager.initialize();
    logger.info('✅ Monitoring job manager initialized');
    
    // Log startup configuration
    logger.info('📋 Monitoring Configuration:', {
      maxConcurrent: process.env.SCRAPER_MAX_CONCURRENT || 2,
      requestDelay: process.env.SCRAPER_REQUEST_DELAY || 5000,
      respectRobotsTxt: process.env.RESPECT_ROBOTS_TXT !== 'false',
      enableHighPriority: true,
      enableMediumPriority: true,
      enableLowPriority: true
    });
    
    // Set up health check endpoint if running standalone
    if (process.argv.includes('--standalone')) {
      const express = require('express');
      const app = express();
      const port = process.env.MONITORING_PORT || 3001;
      
      app.get('/health', (req, res) => {
        const stats = monitoringJobManager.getStats();
        res.json({
          status: stats.isRunning ? 'healthy' : 'unhealthy',
          stats,
          timestamp: new Date().toISOString()
        });
      });
      
      app.get('/stats', (req, res) => {
        res.json(monitoringJobManager.getStats());
      });
      
      app.post('/trigger/:searchId?', async (req, res) => {
        try {
          const searchId = req.params.searchId;
          const result = await monitoringJobManager.runManualCycle(searchId);
          res.json(result);
        } catch (error) {
          logger.error('Manual trigger failed:', error);
          res.status(500).json({ error: error.message });
        }
      });
      
      app.listen(port, () => {
        logger.info(`🌐 Health check server listening on port ${port}`);
        logger.info(`📊 Stats available at http://localhost:${port}/stats`);
        logger.info(`🔧 Manual trigger at http://localhost:${port}/trigger`);
      });
    }
    
    logger.info('🎯 Mobile.de monitoring service is running!');
    logger.info('📈 Background jobs scheduled and active');
    
    // Log initial stats
    setTimeout(() => {
      const stats = monitoringJobManager.getStats();
      logger.info('📊 Initial Statistics:', stats);
    }, 5000);
    
  } catch (error) {
    logger.error('❌ Failed to start monitoring service:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('📤 SIGTERM received, shutting down monitoring service...');
  try {
    await monitoringJobManager.stop();
    logger.info('✅ Monitoring service stopped gracefully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('📤 SIGINT received, shutting down monitoring service...');
  try {
    await monitoringJobManager.stop();
    logger.info('✅ Monitoring service stopped gracefully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('uncaughtException', async (error) => {
  logger.error('💥 Uncaught exception:', error);
  try {
    await monitoringJobManager.stop();
  } catch (stopError) {
    logger.error('Error stopping monitoring service:', stopError);
  }
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('💥 Unhandled rejection:', reason);
  try {
    await monitoringJobManager.stop();
  } catch (stopError) {
    logger.error('Error stopping monitoring service:', stopError);
  }
  process.exit(1);
});

// Start the service
if (require.main === module) {
  startMonitoring();
}

module.exports = { startMonitoring };