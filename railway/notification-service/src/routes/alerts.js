const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { authenticateToken } = require('./auth');
const DatabaseService = require('../services/DatabaseService');
const MobileDEApiBuilder = require('../services/MobileDEApiBuilder');

const router = express.Router();

/**
 * Create New Search Alert
 * POST /api/alerts
 */
router.post('/', authenticateToken, [
  body('name').isLength({ min: 2, max: 100 }).trim().withMessage('Alert name must be 2-100 characters'),
  body('criteria').isObject().withMessage('Search criteria required'),
  body('criteria.make').optional().isString().withMessage('Make must be string'),
  body('criteria.model').optional().isString().withMessage('Model must be string'),
  body('criteria.priceFrom').optional().isNumeric().withMessage('Price from must be numeric'),
  body('criteria.priceTo').optional().isNumeric().withMessage('Price to must be numeric'),
  body('criteria.yearFrom').optional().isInt({ min: 1900, max: 2025 }).withMessage('Year from must be valid'),
  body('criteria.yearTo').optional().isInt({ min: 1900, max: 2025 }).withMessage('Year to must be valid'),
  body('criteria.kmFrom').optional().isNumeric().withMessage('KM from must be numeric'),
  body('criteria.kmTo').optional().isNumeric().withMessage('KM to must be numeric'),
  body('criteria.location').optional().isString().withMessage('Location must be string'),
  body('criteria.radius').optional().isInt({ min: 0, max: 1000 }).withMessage('Radius must be 0-1000 km'),
  body('notificationChannels').isArray().withMessage('Notification channels required'),
  body('notificationChannels.*').isIn(['email', 'sms', 'voice']).withMessage('Invalid notification channel'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, criteria, notificationChannels, isActive = true } = req.body;

    // Validate search criteria
    if (criteria.priceFrom && criteria.priceTo && criteria.priceFrom > criteria.priceTo) {
      return res.status(400).json({
        success: false,
        error: 'Price from cannot be greater than price to'
      });
    }

    if (criteria.yearFrom && criteria.yearTo && criteria.yearFrom > criteria.yearTo) {
      return res.status(400).json({
        success: false,
        error: 'Year from cannot be greater than year to'
      });
    }

    // Create search alert
    const alert = await DatabaseService.createSearchAlert({
      userId: req.user.userId,
      name,
      criteria,
      notificationChannels,
      isActive
    });

    // If active, perform initial search
    if (isActive) {
      try {
        await performSearchAndNotify(alert);
      } catch (searchError) {
        console.warn('Initial search failed:', searchError.message);
        // Continue anyway - alert is created
      }
    }

    res.status(201).json({
      success: true,
      message: 'Search alert created successfully',
      alert: {
        id: alert.id,
        name: alert.name,
        criteria: alert.criteria,
        notificationChannels: alert.notification_channels,
        isActive: alert.is_active,
        createdAt: alert.created_at
      }
    });

  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create search alert',
      details: error.message
    });
  }
});

/**
 * Get User's Search Alerts
 * GET /api/alerts
 */
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  query('active').optional().isBoolean().withMessage('Active filter must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { page = 1, limit = 20, active } = req.query;
    const offset = (page - 1) * limit;

    const result = await DatabaseService.getUserSearchAlerts({
      userId: req.user.userId,
      limit: parseInt(limit),
      offset,
      active: active !== undefined ? active === 'true' : undefined
    });

    res.json({
      success: true,
      alerts: result.alerts.map(alert => ({
        id: alert.id,
        name: alert.name,
        criteria: alert.criteria,
        notificationChannels: alert.notification_channels,
        isActive: alert.is_active,
        lastRun: alert.last_run,
        foundVehicles: alert.found_vehicles_count || 0,
        createdAt: alert.created_at,
        updatedAt: alert.updated_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasNext: (page * limit) < result.total,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get search alerts',
      details: error.message
    });
  }
});

/**
 * Get Specific Search Alert
 * GET /api/alerts/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await DatabaseService.getSearchAlertById(id, req.user.userId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Search alert not found'
      });
    }

    // Get recent found vehicles for this alert
    const recentVehicles = await DatabaseService.getFoundVehiclesByAlert(id, 10);

    res.json({
      success: true,
      alert: {
        id: alert.id,
        name: alert.name,
        criteria: alert.criteria,
        notificationChannels: alert.notification_channels,
        isActive: alert.is_active,
        lastRun: alert.last_run,
        createdAt: alert.created_at,
        updatedAt: alert.updated_at
      },
      recentVehicles: recentVehicles.map(vehicle => ({
        id: vehicle.id,
        title: vehicle.title,
        price: vehicle.price,
        year: vehicle.year,
        mileage: vehicle.mileage,
        location: vehicle.location,
        imageUrl: vehicle.image_url,
        mobileDeUrl: vehicle.mobile_de_url,
        foundAt: vehicle.found_at
      }))
    });

  } catch (error) {
    console.error('Get alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get search alert',
      details: error.message
    });
  }
});

/**
 * Update Search Alert
 * PUT /api/alerts/:id
 */
router.put('/:id', authenticateToken, [
  body('name').optional().isLength({ min: 2, max: 100 }).trim().withMessage('Alert name must be 2-100 characters'),
  body('criteria').optional().isObject().withMessage('Search criteria must be object'),
  body('notificationChannels').optional().isArray().withMessage('Notification channels must be array'),
  body('notificationChannels.*').optional().isIn(['email', 'sms', 'voice']).withMessage('Invalid notification channel'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;

    // Check if alert exists and belongs to user
    const existingAlert = await DatabaseService.getSearchAlertById(id, req.user.userId);
    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        error: 'Search alert not found'
      });
    }

    // Validate criteria if provided
    if (updates.criteria) {
      if (updates.criteria.priceFrom && updates.criteria.priceTo && 
          updates.criteria.priceFrom > updates.criteria.priceTo) {
        return res.status(400).json({
          success: false,
          error: 'Price from cannot be greater than price to'
        });
      }
    }

    const updatedAlert = await DatabaseService.updateSearchAlert(id, updates);

    res.json({
      success: true,
      message: 'Search alert updated successfully',
      alert: {
        id: updatedAlert.id,
        name: updatedAlert.name,
        criteria: updatedAlert.criteria,
        notificationChannels: updatedAlert.notification_channels,
        isActive: updatedAlert.is_active,
        updatedAt: updatedAlert.updated_at
      }
    });

  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update search alert',
      details: error.message
    });
  }
});

/**
 * Delete Search Alert
 * DELETE /api/alerts/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if alert exists and belongs to user
    const existingAlert = await DatabaseService.getSearchAlertById(id, req.user.userId);
    if (!existingAlert) {
      return res.status(404).json({
        success: false,
        error: 'Search alert not found'
      });
    }

    await DatabaseService.deleteSearchAlert(id);

    res.json({
      success: true,
      message: 'Search alert deleted successfully'
    });

  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete search alert',
      details: error.message
    });
  }
});

/**
 * Manually Trigger Search for Alert
 * POST /api/alerts/:id/search
 */
router.post('/:id/search', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if alert exists and belongs to user
    const alert = await DatabaseService.getSearchAlertById(id, req.user.userId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Search alert not found'
      });
    }

    if (!alert.is_active) {
      return res.status(400).json({
        success: false,
        error: 'Cannot search inactive alert'
      });
    }

    // Perform search
    const results = await performSearchAndNotify(alert);

    res.json({
      success: true,
      message: 'Search completed successfully',
      results: {
        vehiclesFound: results.vehiclesFound,
        newVehicles: results.newVehicles,
        notificationsSent: results.notificationsSent
      }
    });

  } catch (error) {
    console.error('Manual search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform search',
      details: error.message
    });
  }
});

/**
 * Get Alert Statistics
 * GET /api/alerts/:id/stats
 */
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if alert exists and belongs to user
    const alert = await DatabaseService.getSearchAlertById(id, req.user.userId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Search alert not found'
      });
    }

    const stats = await DatabaseService.getAlertStatistics(id);

    res.json({
      success: true,
      statistics: {
        totalVehiclesFound: stats.totalVehiclesFound,
        averagePrice: stats.averagePrice,
        priceRange: stats.priceRange,
        popularMakes: stats.popularMakes,
        searchRuns: stats.searchRuns,
        lastRun: alert.last_run,
        notificationsSent: stats.notificationsSent
      }
    });

  } catch (error) {
    console.error('Get alert stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alert statistics',
      details: error.message
    });
  }
});

/**
 * Helper function to perform search and send notifications
 */
async function performSearchAndNotify(alert) {
  const mobileDEBuilder = new MobileDEApiBuilder();
  
  // Build search URL from criteria
  const searchUrl = mobileDEBuilder.buildSearchUrl(alert.criteria);
  
  // Perform search (this would typically call the scraping service)
  const vehicles = await mobileDEBuilder.searchVehicles(alert.criteria);
  
  // Filter out vehicles we've already seen
  const newVehicles = await DatabaseService.filterNewVehicles(alert.id, vehicles);
  
  // Save new vehicles to database
  const savedVehicles = [];
  for (const vehicle of newVehicles) {
    const savedVehicle = await DatabaseService.saveFoundVehicle({
      alertId: alert.id,
      ...vehicle
    });
    savedVehicles.push(savedVehicle);
  }
  
  // Send notifications if new vehicles found
  let notificationsSent = 0;
  if (savedVehicles.length > 0) {
    const NotificationService = require('../services/NotificationService');
    const notificationService = new NotificationService();
    
    for (const channel of alert.notification_channels) {
      try {
        if (channel === 'email') {
          await notificationService.sendEmail({
            to: alert.user_email,
            subject: `New vehicles found for "${alert.name}"`,
            vehicleData: { vehicles: savedVehicles, alertName: alert.name },
            userId: alert.user_id
          });
          notificationsSent++;
        } else if (channel === 'sms') {
          await notificationService.sendSMS({
            phoneNumber: alert.user_phone,
            message: `${savedVehicles.length} new vehicles found for "${alert.name}". Check your email for details.`,
            vehicleData: { vehicles: savedVehicles },
            userId: alert.user_id
          });
          notificationsSent++;
        } else if (channel === 'voice') {
          await notificationService.sendVoiceCall({
            phoneNumber: alert.user_phone,
            message: `New vehicles have been found matching your search criteria for ${alert.name}`,
            vehicleData: { vehicles: savedVehicles },
            userId: alert.user_id
          });
          notificationsSent++;
        }
      } catch (notificationError) {
        console.error(`Failed to send ${channel} notification:`, notificationError);
      }
    }
  }
  
  // Update last run timestamp
  await DatabaseService.updateAlertLastRun(alert.id);
  
  return {
    vehiclesFound: vehicles.length,
    newVehicles: savedVehicles.length,
    notificationsSent
  };
}

module.exports = router;