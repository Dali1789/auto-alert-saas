# Security Fixes Implementation Guide

This document provides step-by-step instructions to implement the security fixes identified in the security assessment.

## Critical Fix 1: Webhook Signature Verification

### Implementation

Replace the simple header comparison with HMAC signature verification:

```javascript
// File: railway/notification-service/src/routes/webhooks.js
const crypto = require('crypto');

// Add signature verification function
function verifyWebhookSignature(payload, signature, secret) {
  if (!signature) {
    throw new Error('Missing webhook signature');
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  const providedSignature = signature.replace('sha256=', '');
  
  if (!crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(providedSignature, 'hex')
  )) {
    throw new Error('Invalid webhook signature');
  }
}

// Update webhook endpoint
router.post('/n8n', async (req, res) => {
  try {
    const signature = req.get('X-Webhook-Signature') || req.get('webhook_signature');
    const payload = JSON.stringify(req.body);
    
    // Verify signature
    verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET);
    
    // Continue with existing logic...
  } catch (error) {
    console.error('Webhook verification failed:', error.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
});
```

## Critical Fix 2: Secure Test Endpoints

### Implementation

Add authentication and environment checks:

```javascript
// File: railway/notification-service/src/routes/webhooks.js

// Add middleware for test endpoints
function requireTestMode(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not Found' });
  }
  
  // Require API key for test endpoints
  const apiKey = req.get('X-API-Key');
  if (!apiKey || apiKey !== process.env.TEST_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

// Secure test endpoint
router.post('/test', requireTestMode, [
  body('testEmail').optional().isEmail(),
  body('testPhone').optional().isMobilePhone(),
], async (req, res) => {
  // Existing test logic with validation
});

// Remove info endpoint or secure it
router.get('/info', requireTestMode, (req, res) => {
  // Limited info only
});
```

## Critical Fix 3: Input Validation Enhancement

### Implementation

Add comprehensive validation schemas:

```javascript
// File: railway/notification-service/src/middleware/validation.js
const { body, validationResult } = require('express-validator');

const vehicleDataValidation = [
  body('vehicleData.title').isString().isLength({ min: 3, max: 200 }).trim(),
  body('vehicleData.price').optional().isInt({ min: 0, max: 10000000 }),
  body('vehicleData.year').optional().isInt({ min: 1900, max: new Date().getFullYear() + 1 }),
  body('vehicleData.mileage').optional().isInt({ min: 0, max: 10000000 }),
  body('vehicleData.make').optional().isString().isLength({ max: 50 }).trim(),
  body('vehicleData.model').optional().isString().isLength({ max: 100 }).trim(),
  body('vehicleData.fuel').optional().isIn(['Benzin', 'Diesel', 'Elektro', 'Hybrid', 'Gas']),
  body('vehicleData.detailUrl').optional().isURL({ protocols: ['https'] }),
];

const webhookValidation = [
  body('searchId').isUUID().withMessage('Valid search ID required'),
  body('newVehicles').isArray({ min: 1, max: 100 }).withMessage('Vehicles array required'),
  body('newVehicles.*.mobileAdId').isString().isLength({ min: 1, max: 50 }).trim(),
  ...vehicleDataValidation.map(rule => 
    rule.optional() // Make optional for array elements
  )
];

module.exports = {
  vehicleDataValidation,
  webhookValidation,
  validateRequest: (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }
    next();
  }
};
```

## Critical Fix 4: Environment Variable Security

### Implementation

Add startup validation and secure handling:

```javascript
// File: railway/notification-service/src/config/environment.js
const crypto = require('crypto');

class EnvironmentConfig {
  constructor() {
    this.validateRequired();
    this.setupSecrets();
  }

  validateRequired() {
    const required = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'WEBHOOK_SECRET',
      'RETELL_API_KEY',
      'RESEND_API_KEY'
    ];

    const missing = required.filter(env => !process.env[env]);
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing);
      process.exit(1);
    }

    // Validate format
    this.validateFormats();
  }

  validateFormats() {
    const formatValidations = {
      SUPABASE_URL: /^https:\/\/.+\.supabase\.co$/,
      RETELL_API_KEY: /^key_[a-zA-Z0-9]+$/,
      RESEND_API_KEY: /^re_[a-zA-Z0-9]+$/,
      WEBHOOK_SECRET: /.{32,}/ // Minimum 32 characters
    };

    for (const [key, pattern] of Object.entries(formatValidations)) {
      if (!pattern.test(process.env[key])) {
        console.error(`❌ Invalid format for ${key}`);
        process.exit(1);
      }
    }
  }

  setupSecrets() {
    // Setup webhook secret validation
    if (process.env.WEBHOOK_SECRET.length < 32) {
      console.error('❌ WEBHOOK_SECRET must be at least 32 characters');
      process.exit(1);
    }
  }

  getConfig() {
    return {
      supabase: {
        url: process.env.SUPABASE_URL,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      retell: {
        apiKey: process.env.RETELL_API_KEY,
        agentId: process.env.RETELL_AGENT_ID,
        phoneNumber: process.env.RETELL_PHONE_NUMBER
      },
      resend: {
        apiKey: process.env.RESEND_API_KEY
      },
      security: {
        webhookSecret: process.env.WEBHOOK_SECRET,
        testApiKey: process.env.TEST_API_KEY || crypto.randomBytes(32).toString('hex')
      },
      server: {
        port: parseInt(process.env.PORT) || 3001,
        nodeEnv: process.env.NODE_ENV || 'development',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
      }
    };
  }
}

module.exports = new EnvironmentConfig();
```

## Critical Fix 5: Comprehensive Rate Limiting

### Implementation

Add global and endpoint-specific rate limiting:

```javascript
// File: railway/notification-service/src/middleware/rateLimiting.js
const rateLimit = require('express-rate-limit');

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased for legitimate traffic
  message: {
    error: 'Too many requests',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Webhook rate limiting (stricter)
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Max 60 webhooks per minute
  message: {
    error: 'Webhook rate limit exceeded',
    retryAfter: 60
  },
  skip: (req) => {
    // Skip rate limiting for verified webhooks
    return req.webhookVerified === true;
  }
});

// Notification rate limiting
const notificationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Max 10 notifications per minute
  keyGenerator: (req) => {
    // Rate limit by user ID if available
    return req.body.userId || req.ip;
  }
});

// Test endpoint rate limiting (very strict)
const testLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Only 5 test requests per 5 minutes
  message: {
    error: 'Test endpoint rate limit exceeded'
  }
});

module.exports = {
  globalLimiter,
  webhookLimiter,
  notificationLimiter,
  testLimiter
};
```

## Critical Fix 6: Authentication Middleware

### Implementation

Add JWT-based authentication:

```javascript
// File: railway/notification-service/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/environment').getConfig();

class AuthMiddleware {
  constructor() {
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );
  }

  // Verify Supabase JWT token
  async verifySupabaseToken(req, res, next) {
    try {
      const authHeader = req.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.substring(7);
      const { data: user, error } = await this.supabase.auth.getUser(token);

      if (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      req.user = user.user;
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({ error: 'Authentication error' });
    }
  }

  // API key authentication for services
  verifyApiKey(req, res, next) {
    const apiKey = req.get('X-API-Key');
    const validKeys = [
      config.security.testApiKey,
      process.env.SERVICE_API_KEY
    ].filter(Boolean);

    if (!apiKey || !validKeys.includes(apiKey)) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.apiKeyAuth = true;
    next();
  }

  // Combined authentication (JWT or API key)
  authenticate(req, res, next) {
    const apiKey = req.get('X-API-Key');
    
    if (apiKey) {
      return this.verifyApiKey(req, res, next);
    } else {
      return this.verifySupabaseToken(req, res, next);
    }
  }
}

module.exports = new AuthMiddleware();
```

## High Priority Fix: Security Headers Enhancement

### Implementation

```javascript
// File: railway/notification-service/src/middleware/security.js
const helmet = require('helmet');

const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.resend.com", "https://api.retellai.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable if causing issues
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
});

module.exports = securityHeaders;
```

## Database Security Enhancement

### Implementation

Add RLS policies and secure queries:

```sql
-- File: database/security-policies.sql

-- Enable RLS on all tables
ALTER TABLE public.auto_alert_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_alert_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_alert_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_alert_notifications ENABLE ROW LEVEL SECURITY;

-- User can only access their own data
CREATE POLICY "Users can view own profile" ON public.auto_alert_user_profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can manage own searches" ON public.auto_alert_searches
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own results" ON public.auto_alert_results
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.auto_alert_searches 
      WHERE id = search_id
    )
  );

-- Service role can access all data
CREATE POLICY "Service role full access" ON public.auto_alert_user_profiles
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role searches access" ON public.auto_alert_searches
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role results access" ON public.auto_alert_results
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role notifications access" ON public.auto_alert_notifications
  FOR ALL USING (auth.role() = 'service_role');
```

## Implementation Checklist

### Phase 1: Critical Fixes (Immediate - 24-48 hours)

- [ ] Implement webhook signature verification
- [ ] Secure or disable test endpoints
- [ ] Add environment variable validation
- [ ] Deploy emergency rate limiting patch

### Phase 2: High Priority (1 week)

- [ ] Complete input validation overhaul
- [ ] Implement authentication middleware
- [ ] Add comprehensive rate limiting
- [ ] Security headers enhancement

### Phase 3: Medium Priority (2 weeks)

- [ ] Database security policies
- [ ] Error handling improvements
- [ ] Logging security enhancement
- [ ] CSRF protection

### Phase 4: Testing and Monitoring (Ongoing)

- [ ] Security test suite
- [ ] Penetration testing
- [ ] Monitoring and alerting
- [ ] Regular security audits

## Testing the Fixes

### Unit Tests

```javascript
// File: tests/security.test.js
const request = require('supertest');
const app = require('../src/server');

describe('Security Tests', () => {
  test('Webhook without signature should fail', async () => {
    const response = await request(app)
      .post('/api/webhooks/n8n')
      .send({ searchId: 'test', newVehicles: [] });
    
    expect(response.status).toBe(401);
  });

  test('Test endpoint should be disabled in production', async () => {
    process.env.NODE_ENV = 'production';
    const response = await request(app)
      .post('/api/webhooks/test')
      .send({});
    
    expect(response.status).toBe(404);
  });

  test('Rate limiting should work', async () => {
    // Send multiple requests quickly
    const promises = Array(200).fill().map(() =>
      request(app).get('/health')
    );
    
    const responses = await Promise.all(promises);
    const rateLimited = responses.filter(r => r.status === 429);
    
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

## Deployment Guide

1. **Environment Variables Update**
   ```bash
   # Add to Railway environment variables
   TEST_API_KEY=generate-strong-random-key
   SERVICE_API_KEY=another-strong-key
   ```

2. **Database Migrations**
   ```bash
   # Apply security policies
   supabase db push --file database/security-policies.sql
   ```

3. **Code Deployment**
   ```bash
   # Deploy with security fixes
   railway deploy
   ```

4. **Verification**
   ```bash
   # Test security endpoints
   curl -H "X-Webhook-Signature: invalid" https://your-app.railway.app/api/webhooks/n8n
   # Should return 401
   ```

This implementation guide provides all the necessary code changes and procedures to address the critical security vulnerabilities identified in the assessment.