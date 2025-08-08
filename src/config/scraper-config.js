/**
 * Configuration for Mobile.de Scraper
 * Centralized configuration for scraping behavior, limits, and settings
 */

const config = {
  // Scraper behavior settings
  scraper: {
    // Request timing
    requestDelay: parseInt(process.env.SCRAPER_REQUEST_DELAY) || 3000, // 3 seconds between requests
    timeout: parseInt(process.env.SCRAPER_TIMEOUT) || 30000, // 30 second timeout
    maxRetries: parseInt(process.env.SCRAPER_MAX_RETRIES) || 3,
    
    // Concurrency
    maxConcurrent: parseInt(process.env.SCRAPER_MAX_CONCURRENT) || 3,
    maxPagesPerSearch: parseInt(process.env.SCRAPER_MAX_PAGES) || 10,
    
    // Browser settings
    headless: process.env.SCRAPER_HEADLESS !== 'false', // Default true
    useProxy: process.env.SCRAPER_USE_PROXY === 'true',
    proxyList: process.env.SCRAPER_PROXY_LIST?.split(',') || [],
    
    // Anti-detection
    randomizeUserAgent: process.env.SCRAPER_RANDOMIZE_UA !== 'false',
    randomizeViewport: process.env.SCRAPER_RANDOMIZE_VIEWPORT !== 'false',
    blockImages: process.env.SCRAPER_BLOCK_IMAGES !== 'false',
    blockCSS: process.env.SCRAPER_BLOCK_CSS !== 'false',
    
    // Compliance
    respectRobotsTxt: process.env.RESPECT_ROBOTS_TXT !== 'false',
    maxDailyRequests: parseInt(process.env.SCRAPER_MAX_DAILY_REQUESTS) || 5000,
    maxHourlyRequests: parseInt(process.env.SCRAPER_MAX_HOURLY_REQUESTS) || 500
  },

  // Mobile.de specific settings
  mobileDe: {
    baseUrl: 'https://www.mobile.de',
    searchPath: '/fahrzeuge/search.html',
    detailsSelector: '.vehicle-details',
    resultsSelector: '[data-testid="result-item"]',
    paginationSelector: '.pagination',
    
    // Search result limits
    maxResultsPerPage: 50,
    maxTotalResults: 1000,
    
    // Rate limiting specific to mobile.de
    mobileDe_requestDelay: 5000, // More conservative for mobile.de
    mobileDe_maxRequestsPerHour: 300,
    
    // Selectors for data extraction
    selectors: {
      title: '.headline-block h2 a, .result-item__header h2 a',
      price: '.price-block .u-text-orange, .result-item__price .price',
      details: '.vehicle-data, .result-item__details',
      location: '.seller-info__location, .result-item__location',
      seller: '.seller-info, .result-item__seller',
      image: 'img[src*="vehicle"], img[data-src*="vehicle"]',
      url: '.headline-block h2 a, .result-item__header h2 a',
      
      // Detail page selectors
      description: '.description, .vehicle-description',
      specifications: '.vehicle-data-table tr, .specifications tr',
      features: '.equipment-list li, .features li',
      sellerInfo: '.seller-name, .dealer-name',
      contact: '[href^="tel:"]',
      address: '.seller-address, .dealer-address'
    }
  },

  // Monitoring and background jobs
  monitoring: {
    // Job schedules (cron expressions)
    schedules: {
      highPriority: process.env.MONITORING_HIGH_PRIORITY || '*/15 * * * *', // Every 15 minutes
      mediumPriority: process.env.MONITORING_MEDIUM_PRIORITY || '0 * * * *', // Every hour  
      lowPriority: process.env.MONITORING_LOW_PRIORITY || '0 */4 * * *', // Every 4 hours
      cleanup: process.env.MONITORING_CLEANUP || '0 2 * * *' // Daily at 2 AM
    },
    
    // Data retention
    retentionDays: parseInt(process.env.DATA_RETENTION_DAYS) || 30,
    maxStoredVehicles: parseInt(process.env.MAX_STORED_VEHICLES) || 100000,
    
    // Notification settings
    maxNotificationsPerUser: parseInt(process.env.MAX_NOTIFICATIONS_PER_USER) || 50,
    notificationCooldown: parseInt(process.env.NOTIFICATION_COOLDOWN) || 300000, // 5 minutes
    
    // Performance thresholds
    maxSearchDuration: parseInt(process.env.MAX_SEARCH_DURATION) || 60000, // 1 minute
    alertOnSlowSearches: process.env.ALERT_ON_SLOW_SEARCHES === 'true'
  },

  // Security settings
  security: {
    // Rate limiting
    rateLimits: {
      search: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX) || 20,
        skipSuccessfulRequests: false
      },
      details: {
        windowMs: parseInt(process.env.RATE_LIMIT_DETAILS_WINDOW) || 600000, // 10 minutes
        max: parseInt(process.env.RATE_LIMIT_DETAILS_MAX) || 100
      }
    },
    
    // IP filtering
    trustedIPs: process.env.TRUSTED_IPS?.split(',') || [],
    blockedIPs: process.env.BLOCKED_IPS?.split(',') || [],
    
    // User agent filtering
    allowedUserAgents: [
      /chrome/i,
      /firefox/i,
      /safari/i,
      /edge/i,
      /mobile.de-alert-system/i
    ],
    
    blockedUserAgents: [
      /bot/i,
      /crawler/i,
      /spider/i,
      /python-requests/i,
      /curl/i,
      /wget/i
    ],
    
    // Content validation
    maxSearchParamLength: parseInt(process.env.MAX_SEARCH_PARAM_LENGTH) || 100,
    maxSearchesPerUser: parseInt(process.env.MAX_SEARCHES_PER_USER) || 10,
    
    // Authentication
    requireAuth: process.env.NODE_ENV === 'production',
    adminRoles: ['admin', 'moderator']
  },

  // Logging and monitoring
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableFileLogging: process.env.ENABLE_FILE_LOGGING !== 'false',
    logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS) || 7,
    
    // Separate log files
    files: {
      scraper: 'logs/mobile-scraper.log',
      scraperError: 'logs/mobile-scraper-error.log',
      monitoring: 'logs/monitoring-jobs.log',
      security: 'logs/scraper-security.log',
      search: 'logs/search-routes.log'
    },
    
    // Structured logging
    includeMetadata: true,
    logRequests: process.env.LOG_REQUESTS !== 'false',
    logResponses: process.env.LOG_RESPONSES === 'true'
  },

  // Database settings
  database: {
    // Connection pool settings for high-concurrency scraping
    poolSize: parseInt(process.env.DB_POOL_SIZE) || 20,
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000,
    
    // Batch processing
    batchSize: parseInt(process.env.DB_BATCH_SIZE) || 100,
    maxBatchWait: parseInt(process.env.DB_MAX_BATCH_WAIT) || 5000,
    
    // Indexing hints
    useIndexes: process.env.DB_USE_INDEXES !== 'false',
    enableQueryOptimization: process.env.DB_OPTIMIZE_QUERIES !== 'false'
  },

  // Performance optimization
  performance: {
    // Memory management
    maxMemoryUsage: parseInt(process.env.MAX_MEMORY_USAGE) || 512, // MB
    enableGarbageCollection: process.env.ENABLE_GC !== 'false',
    gcInterval: parseInt(process.env.GC_INTERVAL) || 300000, // 5 minutes
    
    // Caching
    enableCaching: process.env.ENABLE_CACHING !== 'false',
    cacheTimeout: parseInt(process.env.CACHE_TIMEOUT) || 3600000, // 1 hour
    maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE) || 1000,
    
    // Browser optimization
    browserPool: {
      min: parseInt(process.env.BROWSER_POOL_MIN) || 1,
      max: parseInt(process.env.BROWSER_POOL_MAX) || 5,
      idleTimeout: parseInt(process.env.BROWSER_IDLE_TIMEOUT) || 300000 // 5 minutes
    },
    
    // Resource limits
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE) || 10485760, // 10MB
    maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE) || 1048576, // 1MB
    pageTimeout: parseInt(process.env.PAGE_TIMEOUT) || 30000 // 30 seconds
  },

  // Error handling
  errorHandling: {
    // Retry settings
    retryDelays: [1000, 2000, 5000], // Exponential backoff
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3,
    
    // Error types to retry
    retryableErrors: [
      'TimeoutError',
      'NetworkError', 
      'ProtocolError',
      'CONNECTION_REFUSED'
    ],
    
    // Failure handling
    failSilently: process.env.FAIL_SILENTLY === 'true',
    alertOnFailure: process.env.ALERT_ON_FAILURE !== 'false',
    maxConsecutiveFailures: parseInt(process.env.MAX_CONSECUTIVE_FAILURES) || 5,
    
    // Circuit breaker
    circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 10,
    circuitBreakerTimeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 60000 // 1 minute
  },

  // Development and testing
  development: {
    enableDebugMode: process.env.DEBUG_MODE === 'true',
    mockResponses: process.env.MOCK_RESPONSES === 'true',
    skipRealScraping: process.env.SKIP_REAL_SCRAPING === 'true',
    
    // Test data
    sampleSearchParams: {
      make: 'BMW',
      model: '3er',
      priceFrom: 10000,
      priceTo: 50000,
      yearFrom: 2015,
      zipcode: '10115',
      radius: 50
    },
    
    // Development limits
    devMaxResults: parseInt(process.env.DEV_MAX_RESULTS) || 10,
    devRequestDelay: parseInt(process.env.DEV_REQUEST_DELAY) || 1000
  }
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'development') {
  config.scraper.requestDelay = config.development.devRequestDelay;
  config.scraper.maxConcurrent = 1;
  config.mobileDe.maxTotalResults = config.development.devMaxResults;
  config.logging.level = 'debug';
}

if (process.env.NODE_ENV === 'test') {
  config.scraper.requestDelay = 100;
  config.scraper.timeout = 5000;
  config.development.mockResponses = true;
  config.development.skipRealScraping = true;
}

if (process.env.NODE_ENV === 'production') {
  config.scraper.requestDelay = Math.max(config.scraper.requestDelay, 5000); // Minimum 5 seconds in production
  config.scraper.maxConcurrent = Math.min(config.scraper.maxConcurrent, 2); // Maximum 2 concurrent in production
  config.security.requireAuth = true;
}

// Validation
function validateConfig() {
  const errors = [];
  
  if (config.scraper.requestDelay < 1000) {
    errors.push('Request delay must be at least 1000ms for respectful scraping');
  }
  
  if (config.scraper.maxConcurrent > 5) {
    errors.push('Max concurrent requests should not exceed 5 for respectful scraping');
  }
  
  if (config.mobileDe.maxTotalResults > 10000) {
    errors.push('Max total results should not exceed 10000 to prevent overloading');
  }
  
  if (errors.length > 0) {
    console.warn('Scraper configuration warnings:', errors);
  }
}

// Validate configuration on load
validateConfig();

module.exports = config;