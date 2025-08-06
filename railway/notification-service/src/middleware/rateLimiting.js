const rateLimit = require('express-rate-limit');

// Global rate limiting for all requests
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Allow more requests for legitimate traffic
  message: {
    error: 'Too many requests from this IP',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests from this IP',
      retryAfter: '15 minutes'
    });
  }
});

// Webhook rate limiting (stricter)
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Max 60 webhooks per minute
  message: {
    error: 'Webhook rate limit exceeded',
    retryAfter: '1 minute'
  },
  skip: (req) => {
    // Skip rate limiting for successfully verified webhooks
    return req.webhookVerified === true;
  },
  keyGenerator: (req) => {
    // Rate limit by signature if present, otherwise by IP
    const signature = req.get('X-Webhook-Signature') || req.get('webhook_signature');
    return signature ? `webhook_${crypto.createHash('sha256').update(signature).digest('hex').substring(0, 16)}` : req.ip;
  }
});

// Notification API rate limiting
const notificationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Max 10 notifications per minute per user
  message: {
    error: 'Notification rate limit exceeded',
    retryAfter: '1 minute'
  },
  keyGenerator: (req) => {
    // Rate limit by user ID if available in auth, otherwise by IP
    return req.user?.id || req.body?.userId || req.ip;
  }
});

// Test endpoint rate limiting (very strict)
const testLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Only 5 test requests per 5 minutes
  message: {
    error: 'Test endpoint rate limit exceeded',
    retryAfter: '5 minutes'
  },
  handler: (req, res) => {
    console.log(`Test endpoint rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Test endpoint rate limit exceeded',
      retryAfter: '5 minutes'
    });
  }
});

// Health check rate limiting (moderate)
const healthLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 health checks per minute
  message: {
    error: 'Health check rate limit exceeded'
  }
});

module.exports = {
  globalLimiter,
  webhookLimiter,
  notificationLimiter,
  testLimiter,
  healthLimiter
};