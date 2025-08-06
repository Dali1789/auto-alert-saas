const request = require('supertest');
const crypto = require('crypto');

// Mock environment for testing
process.env.NODE_ENV = 'test';
process.env.WEBHOOK_SECRET = 'test-webhook-secret-32-characters-long';
process.env.TEST_API_KEY = 'test-api-key-32-characters-long';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';

const app = require('../src/server');

describe('Security Tests', () => {
  
  describe('Webhook Security', () => {
    test('should reject webhook without signature', async () => {
      const response = await request(app)
        .post('/api/webhooks/n8n')
        .send({
          searchId: '123e4567-e89b-12d3-a456-426614174000',
          newVehicles: [{
            mobileAdId: 'test123',
            title: 'Test Car',
            price: 10000
          }]
        });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    test('should reject webhook with invalid signature', async () => {
      const payload = JSON.stringify({
        searchId: '123e4567-e89b-12d3-a456-426614174000',
        newVehicles: [{
          mobileAdId: 'test123',
          title: 'Test Car',
          price: 10000
        }]
      });

      const response = await request(app)
        .post('/api/webhooks/n8n')
        .set('X-Webhook-Signature', 'sha256=invalid_signature')
        .send(JSON.parse(payload));
      
      expect(response.status).toBe(401);
    });

    test('should accept webhook with valid signature', async () => {
      const payload = JSON.stringify({
        searchId: '123e4567-e89b-12d3-a456-426614174000',
        newVehicles: [{
          mobileAdId: 'test123',
          title: 'Test Car',
          price: 10000
        }]
      });

      const signature = crypto
        .createHmac('sha256', process.env.WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      const response = await request(app)
        .post('/api/webhooks/n8n')
        .set('X-Webhook-Signature', `sha256=${signature}`)
        .send(JSON.parse(payload));
      
      // Note: This might still fail due to database issues, but signature should be valid
      expect(response.status).not.toBe(401);
    });
  });

  describe('Test Endpoint Security', () => {
    beforeEach(() => {
      // Reset NODE_ENV for each test
      process.env.NODE_ENV = 'test';
    });

    test('should block test endpoint in production', async () => {
      process.env.NODE_ENV = 'production';
      
      const response = await request(app)
        .post('/api/webhooks/test')
        .send({ testEmail: 'test@example.com' });
      
      expect(response.status).toBe(404);
    });

    test('should require API key for test endpoint', async () => {
      const response = await request(app)
        .post('/api/webhooks/test')
        .send({ testEmail: 'test@example.com' });
      
      expect(response.status).toBe(401);
    });

    test('should accept test endpoint with valid API key', async () => {
      const response = await request(app)
        .post('/api/webhooks/test')
        .set('X-API-Key', process.env.TEST_API_KEY)
        .send({ testEmail: 'test@example.com' });
      
      // Note: Might fail due to missing services, but auth should pass
      expect(response.status).not.toBe(401);
    });
  });

  describe('Input Validation', () => {
    test('should reject invalid search ID format', async () => {
      const payload = JSON.stringify({
        searchId: 'invalid-uuid',
        newVehicles: [{
          mobileAdId: 'test123',
          title: 'Test Car'
        }]
      });

      const signature = crypto
        .createHmac('sha256', process.env.WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      const response = await request(app)
        .post('/api/webhooks/n8n')
        .set('X-Webhook-Signature', `sha256=${signature}`)
        .send(JSON.parse(payload));
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    test('should reject empty vehicles array', async () => {
      const payload = JSON.stringify({
        searchId: '123e4567-e89b-12d3-a456-426614174000',
        newVehicles: []
      });

      const signature = crypto
        .createHmac('sha256', process.env.WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      const response = await request(app)
        .post('/api/webhooks/n8n')
        .set('X-Webhook-Signature', `sha256=${signature}`)
        .send(JSON.parse(payload));
      
      expect(response.status).toBe(400);
    });

    test('should reject invalid email in test endpoint', async () => {
      const response = await request(app)
        .post('/api/webhooks/test')
        .set('X-API-Key', process.env.TEST_API_KEY)
        .send({ testEmail: 'invalid-email' });
      
      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting after many requests', async () => {
      // Send multiple requests quickly
      const promises = Array(50).fill().map(() =>
        request(app).get('/health')
      );
      
      const responses = await Promise.all(promises);
      const rateLimited = responses.filter(r => r.status === 429);
      
      // Some requests should be rate limited
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    test('should not expose server information', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });
  });

  describe('CORS Protection', () => {
    test('should reject requests from unauthorized origins', async () => {
      const response = await request(app)
        .post('/api/notifications/email')
        .set('Origin', 'https://malicious-site.com')
        .send({ to: 'test@example.com' });
      
      expect(response.status).toBe(403);
    });
  });
});

describe('Environment Configuration', () => {
  test('should validate required environment variables', () => {
    // This test ensures the environment validation works
    const config = require('../src/config/environment');
    const appConfig = config.getConfig();
    
    expect(appConfig.database.supabaseUrl).toBeDefined();
    expect(appConfig.security.webhookSecret).toBeDefined();
    expect(appConfig.security.webhookSecret.length).toBeGreaterThanOrEqual(32);
  });
});

// Helper function to generate valid webhook signatures
function generateWebhookSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

module.exports = {
  generateWebhookSignature
};