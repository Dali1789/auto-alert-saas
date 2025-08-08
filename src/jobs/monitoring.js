/**
 * Background Monitoring Jobs for Mobile.de Alerts
 * Handles periodic scraping and notification for saved searches
 */

const cron = require('node-cron');
const winston = require('winston');
const MobileDEScraper = require('../services/mobile-scraper');
const DatabaseService = require('../../railway/notification-service/src/services/DatabaseService');
const NotificationService = require('../../railway/notification-service/src/services/NotificationService');
const { v4: uuidv4 } = require('uuid');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/monitoring-jobs.log' }),
    new winston.transports.Console()
  ]
});

class MonitoringJobManager {
  constructor() {
    this.scraper = null;
    this.dbService = null;
    this.notificationService = null;
    this.jobs = new Map();
    this.isRunning = false;
    this.stats = {
      totalSearchesProcessed: 0,
      totalVehiclesFound: 0,
      totalNotificationsSent: 0,
      lastRunTime: null,
      errors: 0
    };
  }

  /**
   * Initialize the monitoring job manager
   */
  async initialize() {
    try {
      logger.info('Initializing monitoring job manager...');

      // Initialize services
      this.scraper = new MobileDEScraper({
        maxConcurrent: 2,
        requestDelay: 5000, // More conservative delay for background jobs
        timeout: 45000,
        maxRetries: 3,
        respectRobotsTxt: true
      });
      
      await this.scraper.initialize();
      
      this.dbService = new DatabaseService();
      this.notificationService = new NotificationService();

      logger.info('Monitoring services initialized successfully');
      
      // Schedule jobs
      this.scheduleJobs();
      
      this.isRunning = true;
      logger.info('Monitoring job manager started');
      
    } catch (error) {
      logger.error('Failed to initialize monitoring job manager:', error);
      throw error;
    }
  }

  /**
   * Schedule all monitoring jobs
   */
  scheduleJobs() {
    // Every 15 minutes - check for high-priority searches
    this.jobs.set('high-priority', cron.schedule('*/15 * * * *', () => {
      this.runMonitoringCycle('high');
    }, { scheduled: false }));

    // Every hour - check for medium-priority searches
    this.jobs.set('medium-priority', cron.schedule('0 * * * *', () => {
      this.runMonitoringCycle('medium');
    }, { scheduled: false }));

    // Every 4 hours - check for low-priority searches
    this.jobs.set('low-priority', cron.schedule('0 */4 * * *', () => {
      this.runMonitoringCycle('low');
    }, { scheduled: false }));

    // Daily - cleanup old data
    this.jobs.set('cleanup', cron.schedule('0 2 * * *', () => {
      this.runCleanupJob();
    }, { scheduled: false }));

    // Start all jobs
    this.jobs.forEach((job, name) => {
      job.start();
      logger.info(`Scheduled job: ${name}`);
    });
  }

  /**
   * Run monitoring cycle for specific priority level
   */
  async runMonitoringCycle(priority) {
    const cycleId = uuidv4();
    
    try {
      logger.info(`Starting monitoring cycle ${cycleId} for priority: ${priority}`);
      
      // Get active searches for this priority
      const searches = await this.dbService.getActiveSearches(priority);
      
      if (searches.length === 0) {
        logger.info(`No active ${priority} priority searches found`);
        return;
      }

      logger.info(`Processing ${searches.length} ${priority} priority searches`);

      const results = await Promise.allSettled(
        searches.map(search => this.processSearch(search, cycleId))
      );

      // Count successes and failures
      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;

      logger.info(`Monitoring cycle ${cycleId} completed: ${successes} successes, ${failures} failures`);
      
      this.stats.lastRunTime = new Date();
      this.stats.errors += failures;

    } catch (error) {
      logger.error(`Monitoring cycle ${cycleId} failed:`, error);
      this.stats.errors++;
    }
  }

  /**
   * Process a single search
   */
  async processSearch(search, cycleId) {
    const startTime = Date.now();
    
    try {
      logger.info(`Processing search ${search.id} (${search.name}) in cycle ${cycleId}`);

      // Perform search using scraper
      const vehicles = await this.scraper.searchVehicles(search.search_params);
      
      // Filter for new vehicles
      const newVehicles = await this.filterNewVehicles(vehicles, search.id);
      
      if (newVehicles.length === 0) {
        logger.info(`No new vehicles found for search ${search.id}`);
        
        // Update last checked time
        await this.dbService.updateSearchLastChecked(search.id);
        return;
      }

      logger.info(`Found ${newVehicles.length} new vehicles for search ${search.id}`);

      // Store new vehicles
      const storedVehicles = await this.storeNewVehicles(newVehicles, search.id);

      // Send notifications
      await this.sendNotifications(search, storedVehicles);

      // Update search statistics
      await this.dbService.updateSearchStats(search.id, {
        last_checked_at: new Date(),
        total_results_found: vehicles.length,
        new_results_found: newVehicles.length,
        last_new_result_at: newVehicles.length > 0 ? new Date() : null
      });

      const duration = Date.now() - startTime;
      logger.info(`Search ${search.id} processed in ${duration}ms`);

      this.stats.totalSearchesProcessed++;
      this.stats.totalVehiclesFound += newVehicles.length;

    } catch (error) {
      logger.error(`Failed to process search ${search.id}:`, error);
      
      // Update search with error
      await this.dbService.updateSearchError(search.id, error.message);
      throw error;
    }
  }

  /**
   * Filter vehicles to find new ones not seen before
   */
  async filterNewVehicles(vehicles, searchId) {
    const newVehicles = [];
    
    for (const vehicle of vehicles) {
      try {
        // Check if vehicle exists in database
        const existing = await this.dbService.getVehicleByUrl(vehicle.url);
        
        if (!existing) {
          // Completely new vehicle
          newVehicles.push({
            ...vehicle,
            isNew: true,
            firstSeenInSearch: searchId
          });
        } else {
          // Check if this is a new result for this specific search
          const seenInThisSearch = await this.dbService.hasVehicleBeenSeenInSearch(
            existing.id, 
            searchId
          );
          
          if (!seenInThisSearch) {
            newVehicles.push({
              ...vehicle,
              isNew: false,
              existingId: existing.id,
              firstSeenInSearch: searchId
            });
          }
        }
      } catch (error) {
        logger.warn(`Error checking vehicle ${vehicle.url}:`, error);
        // Include vehicle anyway to avoid missing alerts
        newVehicles.push(vehicle);
      }
    }
    
    return newVehicles;
  }

  /**
   * Store new vehicles in database
   */
  async storeNewVehicles(newVehicles, searchId) {
    const storedVehicles = [];
    
    for (const vehicle of newVehicles) {
      try {
        let stored;
        
        if (vehicle.isNew) {
          // Create new vehicle record
          stored = await this.dbService.createVehicle({
            ...vehicle,
            search_id: searchId,
            first_seen_at: new Date(),
            last_seen_at: new Date()
          });
        } else {
          // Link existing vehicle to this search
          await this.dbService.addVehicleToSearch(vehicle.existingId, searchId);
          
          // Update last seen time
          stored = await this.dbService.updateVehicle(vehicle.existingId, {
            last_seen_at: new Date()
          });
        }
        
        storedVehicles.push(stored);
        
      } catch (error) {
        logger.warn(`Failed to store vehicle ${vehicle.url}:`, error);
      }
    }
    
    return storedVehicles;
  }

  /**
   * Send notifications for new vehicles
   */
  async sendNotifications(search, newVehicles) {
    try {
      // Get user notification preferences
      const user = await this.dbService.getUserById(search.user_id);
      
      if (!user || !user.notification_enabled) {
        logger.info(`Notifications disabled for user ${search.user_id}`);
        return;
      }

      // Group vehicles by notification type preference
      const notifications = this.groupVehiclesForNotification(newVehicles, user.notification_preferences);

      // Send email notification if enabled
      if (user.email_notifications && notifications.email.length > 0) {
        await this.notificationService.sendVehicleAlertEmail({
          user,
          search,
          vehicles: notifications.email,
          type: 'new_vehicles'
        });
        
        this.stats.totalNotificationsSent++;
        logger.info(`Email notification sent to ${user.email} for ${notifications.email.length} vehicles`);
      }

      // Send push notification if enabled
      if (user.push_notifications && notifications.push.length > 0) {
        await this.notificationService.sendPushNotification({
          userId: user.id,
          title: `${notifications.push.length} neue ${search.name} gefunden`,
          body: this.createPushNotificationBody(notifications.push),
          data: {
            searchId: search.id,
            vehicleIds: notifications.push.map(v => v.id)
          }
        });
        
        this.stats.totalNotificationsSent++;
        logger.info(`Push notification sent to user ${user.id} for ${notifications.push.length} vehicles`);
      }

      // Send webhook if configured
      if (user.webhook_url && notifications.webhook.length > 0) {
        await this.notificationService.sendWebhookNotification({
          url: user.webhook_url,
          data: {
            searchId: search.id,
            searchName: search.name,
            userId: user.id,
            vehicles: notifications.webhook,
            timestamp: new Date().toISOString()
          }
        });
        
        logger.info(`Webhook notification sent for ${notifications.webhook.length} vehicles`);
      }

    } catch (error) {
      logger.error(`Failed to send notifications for search ${search.id}:`, error);
      throw error;
    }
  }

  /**
   * Group vehicles by notification preferences
   */
  groupVehiclesForNotification(vehicles, preferences) {
    const defaultPrefs = {
      email: true,
      push: true,
      webhook: false,
      maxPerNotification: 10
    };
    
    const prefs = { ...defaultPrefs, ...preferences };
    
    // Limit vehicles per notification
    const limitedVehicles = vehicles.slice(0, prefs.maxPerNotification);
    
    return {
      email: prefs.email ? limitedVehicles : [],
      push: prefs.push ? limitedVehicles : [],
      webhook: prefs.webhook ? limitedVehicles : []
    };
  }

  /**
   * Create push notification body text
   */
  createPushNotificationBody(vehicles) {
    if (vehicles.length === 1) {
      const v = vehicles[0];
      return `${v.title} - ${v.price ? v.price.toLocaleString() + '€' : 'Preis auf Anfrage'}`;
    } else {
      const priceRange = this.getPriceRange(vehicles);
      return `Neue Fahrzeuge gefunden${priceRange ? ` (${priceRange})` : ''}`;
    }
  }

  /**
   * Get price range for multiple vehicles
   */
  getPriceRange(vehicles) {
    const prices = vehicles.filter(v => v.price && v.price > 0).map(v => v.price);
    
    if (prices.length === 0) return null;
    
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    
    if (min === max) return `${min.toLocaleString()}€`;
    return `${min.toLocaleString()}€ - ${max.toLocaleString()}€`;
  }

  /**
   * Run cleanup job to remove old data
   */
  async runCleanupJob() {
    try {
      logger.info('Starting cleanup job...');
      
      const retentionDays = 30; // Keep data for 30 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Clean up old vehicle records
      const deletedVehicles = await this.dbService.deleteOldVehicles(cutoffDate);
      
      // Clean up old search results
      const deletedResults = await this.dbService.deleteOldSearchResults(cutoffDate);

      // Clean up old error logs
      const deletedErrors = await this.dbService.deleteOldErrorLogs(cutoffDate);

      logger.info(`Cleanup completed: ${deletedVehicles} vehicles, ${deletedResults} results, ${deletedErrors} errors deleted`);

    } catch (error) {
      logger.error('Cleanup job failed:', error);
    }
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      activeJobs: Array.from(this.jobs.keys()),
      scraperStats: this.scraper ? this.scraper.getStats() : null
    };
  }

  /**
   * Stop all monitoring jobs
   */
  async stop() {
    try {
      logger.info('Stopping monitoring job manager...');
      
      // Stop all cron jobs
      this.jobs.forEach((job, name) => {
        job.stop();
        logger.info(`Stopped job: ${name}`);
      });

      // Clean up scraper
      if (this.scraper) {
        await this.scraper.cleanup();
      }

      this.isRunning = false;
      logger.info('Monitoring job manager stopped');
      
    } catch (error) {
      logger.error('Error stopping monitoring job manager:', error);
      throw error;
    }
  }

  /**
   * Restart monitoring jobs
   */
  async restart() {
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    await this.initialize();
  }

  /**
   * Run a manual monitoring cycle for testing
   */
  async runManualCycle(searchId = null) {
    const cycleId = uuidv4();
    
    try {
      logger.info(`Running manual monitoring cycle ${cycleId}`);
      
      let searches;
      if (searchId) {
        const search = await this.dbService.getSearchById(searchId);
        searches = search ? [search] : [];
      } else {
        searches = await this.dbService.getActiveSearches();
      }

      if (searches.length === 0) {
        return { message: 'No active searches found', cycleId };
      }

      const results = [];
      for (const search of searches) {
        try {
          await this.processSearch(search, cycleId);
          results.push({ searchId: search.id, status: 'success' });
        } catch (error) {
          results.push({ 
            searchId: search.id, 
            status: 'error', 
            error: error.message 
          });
        }
      }

      return { cycleId, results };

    } catch (error) {
      logger.error(`Manual monitoring cycle ${cycleId} failed:`, error);
      throw error;
    }
  }
}

// Create singleton instance
const monitoringJobManager = new MonitoringJobManager();

// Export both the class and instance
module.exports = {
  MonitoringJobManager,
  monitoringJobManager
};

// Auto-start if running as main process
if (require.main === module) {
  monitoringJobManager.initialize().catch(error => {
    logger.error('Failed to start monitoring job manager:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await monitoringJobManager.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await monitoringJobManager.stop();
    process.exit(0);
  });
}