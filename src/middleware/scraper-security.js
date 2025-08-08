/**
 * Security middleware for Mobile.de scraper
 * Implements security measures and compliance checks
 */

const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/scraper-security.log' }),
    new winston.transports.Console()
  ]
});

/**
 * Rate limiting for scraper endpoints
 */
const createScraperRateLimit = (options = {}) => {
  const defaults = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per windowMs
    message: {
      error: 'Too many search requests',
      retryAfter: 'Please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skip: (req) => {
      // Skip rate limiting for admins or trusted IPs
      return req.user?.role === 'admin' || isTrustedIP(req.ip);
    }
  };

  return rateLimit({ ...defaults, ...options });
};

/**
 * Check if IP is in trusted list
 */
function isTrustedIP(ip) {
  const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
  return trustedIPs.includes(ip);
}

/**
 * Validate and sanitize search parameters
 */
const validateSearchParams = (req, res, next) => {
  try {
    const params = req.body;
    const requestId = uuidv4();
    
    logger.info(`Validating search params for request ${requestId}:`, params);

    // Check for required authentication
    if (!req.user && process.env.NODE_ENV === 'production') {
      return res.status(401).json({
        error: 'Authentication required for search requests'
      });
    }

    // Validate make/model parameters
    if (params.make && typeof params.make !== 'string') {
      return res.status(400).json({
        error: 'Invalid make parameter'
      });
    }

    if (params.model && typeof params.model !== 'string') {
      return res.status(400).json({
        error: 'Invalid model parameter'
      });
    }

    // Validate price ranges
    if (params.priceFrom && (typeof params.priceFrom !== 'number' || params.priceFrom < 0)) {
      return res.status(400).json({
        error: 'Invalid priceFrom parameter'
      });
    }

    if (params.priceTo && (typeof params.priceTo !== 'number' || params.priceTo < 0)) {
      return res.status(400).json({
        error: 'Invalid priceTo parameter'
      });
    }

    // Validate year ranges
    const currentYear = new Date().getFullYear();
    if (params.yearFrom && (typeof params.yearFrom !== 'number' || 
        params.yearFrom < 1950 || params.yearFrom > currentYear + 1)) {
      return res.status(400).json({
        error: 'Invalid yearFrom parameter'
      });
    }

    if (params.yearTo && (typeof params.yearTo !== 'number' || 
        params.yearTo < 1950 || params.yearTo > currentYear + 1)) {
      return res.status(400).json({
        error: 'Invalid yearTo parameter'
      });
    }

    // Validate zipcode
    if (params.zipcode && !/^\d{5}$/.test(params.zipcode)) {
      return res.status(400).json({
        error: 'Invalid zipcode format (must be 5 digits)'
      });
    }

    // Validate radius
    if (params.radius && (typeof params.radius !== 'number' || 
        params.radius < 5 || params.radius > 200)) {
      return res.status(400).json({
        error: 'Invalid radius (must be between 5 and 200 km)'
      });
    }

    // Sanitize string parameters
    const stringParams = ['make', 'model', 'category', 'fuel', 'transmission', 'condition'];
    stringParams.forEach(param => {
      if (params[param]) {
        params[param] = sanitizeString(params[param]);
      }
    });

    // Check for suspicious patterns
    if (containsSuspiciousPatterns(params)) {
      logger.warn(`Suspicious search parameters detected from ${req.ip}:`, params);
      return res.status(400).json({
        error: 'Invalid search parameters detected'
      });
    }

    // Add request tracking
    req.searchRequestId = requestId;
    req.sanitizedParams = params;

    next();

  } catch (error) {
    logger.error('Error validating search parameters:', error);
    res.status(500).json({
      error: 'Parameter validation failed'
    });
  }
};

/**
 * Sanitize string input to prevent injection attacks
 */
function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>'"]/g, '') // Remove potentially dangerous characters
    .substring(0, 100); // Limit length
}

/**
 * Check for suspicious patterns in search parameters
 */
function containsSuspiciousPatterns(params) {
  const suspiciousPatterns = [
    /script/i,
    /javascript/i,
    /vbscript/i,
    /onload/i,
    /onerror/i,
    /eval\(/i,
    /expression\(/i,
    /url\(/i,
    /import\(/i,
    /<.*>/,
    /\.\.\//,
    /union\s+select/i,
    /drop\s+table/i,
    /insert\s+into/i,
    /delete\s+from/i
  ];

  const paramString = JSON.stringify(params).toLowerCase();
  
  return suspiciousPatterns.some(pattern => pattern.test(paramString));
}

/**
 * Monitor and log scraper usage
 */
const monitorScraperUsage = (req, res, next) => {
  const startTime = Date.now();
  
  // Track request
  logger.info('Scraper request started:', {
    requestId: req.searchRequestId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Override res.json to capture response
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.info('Scraper request completed:', {
      requestId: req.searchRequestId,
      duration,
      resultsCount: data.results?.count || 0,
      success: res.statusCode < 400
    });

    // Track usage statistics
    if (req.user?.id) {
      trackUserUsage(req.user.id, {
        requestCount: 1,
        resultsReturned: data.results?.count || 0,
        processingTime: duration
      });
    }

    return originalJson.call(this, data);
  };

  next();
};

/**
 * Track user usage statistics
 */
async function trackUserUsage(userId, stats) {
  try {
    // This would integrate with your analytics/metrics system
    // For now, just log it
    logger.info('User usage tracked:', { userId, ...stats });
  } catch (error) {
    logger.warn('Failed to track user usage:', error);
  }
}

/**
 * Check robots.txt compliance
 */
const checkRobotsCompliance = async (req, res, next) => {
  try {
    // Skip check in development
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    // Check if robots.txt checking is enabled
    const respectRobots = process.env.RESPECT_ROBOTS_TXT !== 'false';
    if (!respectRobots) {
      return next();
    }

    // Simplified robots.txt check
    // In production, this should be more sophisticated
    const robotsAllowed = await checkRobotsTxtAllowed();
    
    if (!robotsAllowed) {
      logger.warn('Robots.txt disallows scraping, blocking request');
      return res.status(403).json({
        error: 'Scraping not permitted by robots.txt',
        compliance: 'This service respects robots.txt directives'
      });
    }

    next();

  } catch (error) {
    logger.warn('Failed to check robots.txt compliance:', error);
    // Don't block request on error, but log it
    next();
  }
};

/**
 * Check robots.txt rules
 */
async function checkRobotsTxtAllowed() {
  try {
    const response = await fetch('https://www.mobile.de/robots.txt', {
      timeout: 5000
    });
    
    if (!response.ok) return true; // Allow if can't fetch robots.txt
    
    const robotsTxt = await response.text();
    
    // Check for specific disallow rules
    const lines = robotsTxt.split('\n').map(line => line.trim().toLowerCase());
    let userAgentMatch = false;
    
    for (const line of lines) {
      if (line.startsWith('user-agent: *') || line.startsWith('user-agent:*')) {
        userAgentMatch = true;
      } else if (userAgentMatch && line.startsWith('disallow:')) {
        const disallowPath = line.split(':')[1]?.trim();
        if (disallowPath === '/' || disallowPath === '/fahrzeuge') {
          return false;
        }
      } else if (line.startsWith('user-agent:') && !line.includes('*')) {
        userAgentMatch = false;
      }
    }
    
    return true;
    
  } catch (error) {
    // Allow scraping if we can't check robots.txt
    return true;
  }
}

/**
 * Detect and prevent bot-like behavior
 */
const antibotProtection = (req, res, next) => {
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip;
  
  // Check for suspicious user agents
  const suspiciousAgents = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /python/i,
    /curl/i,
    /wget/i
  ];

  // Allow legitimate browsers and our own scraper
  const legitimateAgents = [
    /chrome/i,
    /firefox/i,
    /safari/i,
    /edge/i,
    /mobile.de-alert-system/i // Our own user agent
  ];

  const isSuspicious = suspiciousAgents.some(pattern => pattern.test(userAgent));
  const isLegitimate = legitimateAgents.some(pattern => pattern.test(userAgent));

  if (isSuspicious && !isLegitimate) {
    logger.warn(`Suspicious user agent blocked: ${userAgent} from ${ip}`);
    return res.status(403).json({
      error: 'Access denied',
      reason: 'Suspicious user agent detected'
    });
  }

  // Check for missing headers that browsers typically send
  const hasReferer = req.get('Referer');
  const hasAccept = req.get('Accept');
  
  if (!hasReferer && !hasAccept && process.env.NODE_ENV === 'production') {
    logger.warn(`Missing browser headers from ${ip}: ${userAgent}`);
    // Don't block immediately, but increase suspicion score
  }

  next();
};

/**
 * Add security headers
 */
const addSecurityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  
  next();
};

module.exports = {
  createScraperRateLimit,
  validateSearchParams,
  monitorScraperUsage,
  checkRobotsCompliance,
  antibotProtection,
  addSecurityHeaders
};