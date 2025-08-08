/**
 * Search Routes for Mobile.de Integration
 * Handles vehicle search requests and integrates with scraper
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const winston = require('winston');
const MobileDEScraper = require('../services/mobile-scraper');
const DatabaseService = require('../../railway/notification-service/src/services/DatabaseService');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/search-routes.log' }),
    new winston.transports.Console()
  ]
});

// Initialize services
let scraper = null;
let dbService = null;

// Initialize scraper (singleton)
async function initializeScraper() {
  if (!scraper) {
    scraper = new MobileDEScraper({
      maxConcurrent: 3,
      requestDelay: 3000, // Respectful 3 second delay
      timeout: 30000,
      maxRetries: 3,
      respectRobotsTxt: true
    });
    
    await scraper.initialize();
    logger.info('Mobile.de scraper initialized');
  }
  return scraper;
}

// Initialize database service
async function initializeDbService() {
  if (!dbService) {
    dbService = new DatabaseService();
    logger.info('Database service initialized');
  }
  return dbService;
}

// Validation middleware for search parameters
const validateSearchParams = [
  body('make').optional().isString().isLength({ min: 2, max: 50 }),
  body('model').optional().isString().isLength({ min: 1, max: 100 }),
  body('category').optional().isIn(['Limousine', 'Kombi', 'SUV', 'Cabrio', 'Coupe', 'Van', 'Kleinwagen']),
  body('priceFrom').optional().isInt({ min: 0, max: 1000000 }),
  body('priceTo').optional().isInt({ min: 0, max: 1000000 }),
  body('yearFrom').optional().isInt({ min: 1950, max: new Date().getFullYear() + 1 }),
  body('yearTo').optional().isInt({ min: 1950, max: new Date().getFullYear() + 1 }),
  body('mileageFrom').optional().isInt({ min: 0, max: 1000000 }),
  body('mileageTo').optional().isInt({ min: 0, max: 1000000 }),
  body('fuel').optional().isIn(['Benzin', 'Diesel', 'Elektro', 'Hybrid', 'Gas']),
  body('transmission').optional().isIn(['Manuell', 'Automatik', 'Halbautomatik']),
  body('condition').optional().isIn(['Neu', 'Gebraucht', 'Vorführfahrzeug']),
  body('sellerType').optional().isIn(['private', 'dealer']),
  body('zipcode').optional().isString().matches(/^\d{5}$/),
  body('radius').optional().isInt({ min: 5, max: 200 }),
  body('saveSearch').optional().isBoolean(),
  body('alertName').optional().isString().isLength({ min: 3, max: 100 })
];

/**
 * POST /api/search-cars
 * Search for cars on Mobile.de
 */
router.post('/search-cars', validateSearchParams, async (req, res) => {
  const requestId = uuidv4();
  
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const searchParams = req.body;
    const userId = req.user?.id || 'anonymous'; // Assumes auth middleware sets req.user
    
    logger.info(`Search request ${requestId} from user ${userId}:`, searchParams);

    // Initialize services
    const scraperInstance = await initializeScraper();
    const dbServiceInstance = await initializeDbService();

    // Validate price range
    if (searchParams.priceFrom && searchParams.priceTo && 
        searchParams.priceFrom > searchParams.priceTo) {
      return res.status(400).json({
        error: 'priceFrom cannot be greater than priceTo'
      });
    }

    // Validate year range
    if (searchParams.yearFrom && searchParams.yearTo && 
        searchParams.yearFrom > searchParams.yearTo) {
      return res.status(400).json({
        error: 'yearFrom cannot be greater than yearTo'
      });
    }

    // Check robots.txt compliance
    const robotsAllowed = await scraperInstance.checkRobotsTxt();
    if (!robotsAllowed) {
      return res.status(403).json({
        error: 'Scraping not allowed by robots.txt'
      });
    }

    // Perform search
    const startTime = Date.now();
    const vehicles = await scraperInstance.searchVehicles(searchParams);
    const searchDuration = Date.now() - startTime;

    logger.info(`Search ${requestId} completed in ${searchDuration}ms, found ${vehicles.length} vehicles`);

    // Save search to database if requested
    let searchRecord = null;
    if (searchParams.saveSearch && userId !== 'anonymous') {
      try {
        searchRecord = await dbServiceInstance.createSearch({
          user_id: userId,
          name: searchParams.alertName || generateSearchName(searchParams),
          search_params: searchParams,
          is_active: true,
          created_at: new Date()
        });
        
        logger.info(`Search saved with ID: ${searchRecord.id}`);
      } catch (dbError) {
        logger.error(`Failed to save search: ${dbError.message}`);
        // Don't fail the request if saving search fails
      }
    }

    // Store vehicles in database for caching and deduplication
    const storedVehicles = await storeVehicles(vehicles, searchRecord?.id, dbServiceInstance);

    // Prepare response
    const response = {
      requestId,
      searchParams,
      results: {
        count: vehicles.length,
        vehicles: vehicles.slice(0, 50), // Limit response size
        searchDuration,
        timestamp: new Date().toISOString()
      }
    };

    if (searchRecord) {
      response.searchId = searchRecord.id;
      response.searchName = searchRecord.name;
    }

    // Add search statistics
    response.stats = scraperInstance.getStats();

    res.json(response);

  } catch (error) {
    logger.error(`Search request ${requestId} failed:`, error);
    
    res.status(500).json({
      error: 'Search failed',
      message: error.message,
      requestId
    });
  }
});

/**
 * GET /api/search-cars/saved
 * Get user's saved searches
 */
router.get('/saved', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const dbServiceInstance = await initializeDbService();
    const savedSearches = await dbServiceInstance.getUserSearches(userId);

    res.json({
      searches: savedSearches,
      count: savedSearches.length
    });

  } catch (error) {
    logger.error('Failed to fetch saved searches:', error);
    res.status(500).json({
      error: 'Failed to fetch saved searches',
      message: error.message
    });
  }
});

/**
 * PUT /api/search-cars/saved/:searchId
 * Update saved search
 */
router.put('/saved/:searchId', validateSearchParams, async (req, res) => {
  try {
    const { searchId } = req.params;
    const userId = req.user?.id;
    const updates = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const dbServiceInstance = await initializeDbService();
    
    // Verify ownership
    const existingSearch = await dbServiceInstance.getSearchById(searchId);
    if (!existingSearch || existingSearch.user_id !== userId) {
      return res.status(404).json({ error: 'Search not found' });
    }

    // Update search
    const updatedSearch = await dbServiceInstance.updateSearch(searchId, {
      name: updates.alertName || existingSearch.name,
      search_params: updates,
      is_active: updates.isActive !== undefined ? updates.isActive : existingSearch.is_active,
      updated_at: new Date()
    });

    res.json({
      message: 'Search updated successfully',
      search: updatedSearch
    });

  } catch (error) {
    logger.error('Failed to update saved search:', error);
    res.status(500).json({
      error: 'Failed to update search',
      message: error.message
    });
  }
});

/**
 * DELETE /api/search-cars/saved/:searchId
 * Delete saved search
 */
router.delete('/saved/:searchId', async (req, res) => {
  try {
    const { searchId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const dbServiceInstance = await initializeDbService();
    
    // Verify ownership
    const existingSearch = await dbServiceInstance.getSearchById(searchId);
    if (!existingSearch || existingSearch.user_id !== userId) {
      return res.status(404).json({ error: 'Search not found' });
    }

    // Delete search
    await dbServiceInstance.deleteSearch(searchId);

    res.json({ message: 'Search deleted successfully' });

  } catch (error) {
    logger.error('Failed to delete saved search:', error);
    res.status(500).json({
      error: 'Failed to delete search',
      message: error.message
    });
  }
});

/**
 * GET /api/search-cars/vehicle/:vehicleId/details
 * Get detailed information for a specific vehicle
 */
router.get('/vehicle/:vehicleId/details', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    
    const dbServiceInstance = await initializeDbService();
    
    // First try to get from database
    let vehicle = await dbServiceInstance.getVehicleById(vehicleId);
    
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // If we need fresh details, scrape them
    if (!vehicle.detailed_data || shouldRefreshDetails(vehicle.updated_at)) {
      try {
        const scraperInstance = await initializeScraper();
        const detailedData = await scraperInstance.scrapeVehicleDetails(vehicle.url);
        
        // Update vehicle with detailed data
        vehicle = await dbServiceInstance.updateVehicle(vehicleId, {
          detailed_data: detailedData,
          updated_at: new Date()
        });
        
        logger.info(`Updated vehicle ${vehicleId} with fresh details`);
      } catch (scrapeError) {
        logger.warn(`Failed to refresh details for vehicle ${vehicleId}:`, scrapeError);
        // Return cached data even if refresh fails
      }
    }

    res.json({ vehicle });

  } catch (error) {
    logger.error('Failed to get vehicle details:', error);
    res.status(500).json({
      error: 'Failed to get vehicle details',
      message: error.message
    });
  }
});

/**
 * GET /api/search-cars/stats
 * Get search and scraper statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const scraperInstance = await initializeScraper();
    const dbServiceInstance = await initializeDbService();
    
    const [scraperStats, dbStats] = await Promise.all([
      scraperInstance.getStats(),
      dbServiceInstance.getSearchStats()
    ]);

    res.json({
      scraper: scraperStats,
      database: dbStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get stats:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});

// Helper functions

/**
 * Generate a descriptive name for the search
 */
function generateSearchName(searchParams) {
  let name = '';
  
  if (searchParams.make) {
    name += searchParams.make;
    if (searchParams.model) {
      name += ` ${searchParams.model}`;
    }
  } else {
    name = 'Fahrzeugsuche';
  }
  
  if (searchParams.priceTo) {
    name += ` bis ${searchParams.priceTo.toLocaleString()}€`;
  }
  
  if (searchParams.yearFrom) {
    name += ` ab ${searchParams.yearFrom}`;
  }
  
  return name;
}

/**
 * Store vehicles in database with deduplication
 */
async function storeVehicles(vehicles, searchId, dbService) {
  const storedVehicles = [];
  
  for (const vehicle of vehicles) {
    try {
      // Check if vehicle already exists
      const existing = await dbService.getVehicleByUrl(vehicle.url);
      
      if (existing) {
        // Update existing vehicle
        const updated = await dbService.updateVehicle(existing.id, {
          ...vehicle,
          search_id: searchId,
          last_seen_at: new Date(),
          updated_at: new Date()
        });
        storedVehicles.push(updated);
      } else {
        // Create new vehicle record
        const created = await dbService.createVehicle({
          ...vehicle,
          search_id: searchId,
          first_seen_at: new Date(),
          last_seen_at: new Date(),
          created_at: new Date()
        });
        storedVehicles.push(created);
      }
    } catch (dbError) {
      logger.warn(`Failed to store vehicle ${vehicle.url}:`, dbError.message);
    }
  }
  
  return storedVehicles;
}

/**
 * Check if vehicle details should be refreshed
 */
function shouldRefreshDetails(lastUpdated) {
  if (!lastUpdated) return true;
  
  const hoursSinceUpdate = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60);
  return hoursSinceUpdate > 24; // Refresh after 24 hours
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down search routes...');
  if (scraper) {
    await scraper.cleanup();
  }
});

process.on('SIGINT', async () => {
  logger.info('Shutting down search routes...');
  if (scraper) {
    await scraper.cleanup();
  }
});

module.exports = router;