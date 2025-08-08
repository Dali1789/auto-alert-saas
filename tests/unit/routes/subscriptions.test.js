const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../railway/notification-service/src/server');

// Mock DatabaseService
jest.mock('../../../railway/notification-service/src/services/DatabaseService');
const DatabaseService = require('../../../railway/notification-service/src/services/DatabaseService');

describe('Subscriptions Routes', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User'
  };

  const token = jwt.sign(
    { userId: mockUser.id, email: mockUser.email, name: mockUser.name },
    process.env.JWT_SECRET || 'development-jwt-secret-key-change-in-production'
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/subscriptions/plans', () => {
    it('should return available subscription plans', async () => {
      const response = await request(app)
        .get('/api/subscriptions/plans');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.plans).toHaveLength(4); // free, basic, premium, enterprise
      expect(response.body.plans[0]).toHaveProperty('id');
      expect(response.body.plans[0]).toHaveProperty('name');
      expect(response.body.plans[0]).toHaveProperty('price');
      expect(response.body.plans[0]).toHaveProperty('maxAlerts');
    });
  });

  describe('GET /api/subscriptions/current', () => {
    it('should return current subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        tier: 'basic',
        status: 'active',
        current_period_start: '2024-01-01T00:00:00Z',
        current_period_end: '2024-02-01T00:00:00Z'
      };

      DatabaseService.getUserSubscription.mockResolvedValue(mockSubscription);
      DatabaseService.getUserActiveAlertsCount.mockResolvedValue(3);

      const response = await request(app)
        .get('/api/subscriptions/current')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.subscription.tier).toBe('basic');
      expect(response.body.subscription.alertsUsed).toBe(3);
    });

    it('should return free tier for users without subscription', async () => {
      DatabaseService.getUserSubscription.mockResolvedValue(null);
      DatabaseService.getUserActiveAlertsCount.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/subscriptions/current')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.subscription.tier).toBe('free');
      expect(response.body.subscription.alertsUsed).toBe(1);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/subscriptions/current');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/subscriptions/create', () => {
    const subscriptionData = {
      tier: 'basic',
      paymentMethodId: 'pm_test_123',
      billingAddress: {
        country: 'DE',
        postalCode: '10115'
      }
    };

    it('should create new subscription successfully', async () => {
      const createdSubscription = {
        id: 'sub-123',
        tier: 'basic',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      DatabaseService.getUserSubscription.mockResolvedValue(null);
      DatabaseService.createSubscription.mockResolvedValue(createdSubscription);
      DatabaseService.logSubscriptionEvent.mockResolvedValue();

      const response = await request(app)
        .post('/api/subscriptions/create')
        .set('Authorization', `Bearer ${token}`)
        .send(subscriptionData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.subscription.tier).toBe('basic');
    });

    it('should upgrade existing subscription', async () => {
      const existingSubscription = {
        id: 'sub-123',
        tier: 'free',
        status: 'active'
      };

      const upgradedSubscription = {
        ...existingSubscription,
        tier: 'basic',
        updated_at: new Date().toISOString()
      };

      DatabaseService.getUserSubscription.mockResolvedValue(existingSubscription);
      DatabaseService.updateSubscription.mockResolvedValue(upgradedSubscription);
      DatabaseService.logSubscriptionEvent.mockResolvedValue();

      const response = await request(app)
        .post('/api/subscriptions/create')
        .set('Authorization', `Bearer ${token}`)
        .send(subscriptionData);

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('upgraded to');
    });

    it('should reject duplicate tier subscription', async () => {
      const existingSubscription = {
        id: 'sub-123',
        tier: 'basic',
        status: 'active'
      };

      DatabaseService.getUserSubscription.mockResolvedValue(existingSubscription);

      const response = await request(app)
        .post('/api/subscriptions/create')
        .set('Authorization', `Bearer ${token}`)
        .send(subscriptionData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Already subscribed');
    });

    it('should require payment method for paid tiers', async () => {
      const invalidData = {
        tier: 'basic'
        // Missing paymentMethodId
      };

      DatabaseService.getUserSubscription.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/subscriptions/create')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Payment method required');
    });

    it('should validate subscription tier', async () => {
      const invalidData = {
        tier: 'invalid-tier'
      };

      const response = await request(app)
        .post('/api/subscriptions/create')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/subscriptions/cancel', () => {
    it('should cancel subscription at period end', async () => {
      const mockSubscription = {
        id: 'sub-123',
        tier: 'basic',
        status: 'active'
      };

      const cancelledSubscription = {
        ...mockSubscription,
        cancel_at_period_end: true,
        updated_at: new Date().toISOString()
      };

      DatabaseService.getUserSubscription.mockResolvedValue(mockSubscription);
      DatabaseService.updateSubscription.mockResolvedValue(cancelledSubscription);
      DatabaseService.logSubscriptionEvent.mockResolvedValue();

      const response = await request(app)
        .post('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${token}`)
        .send({ cancelAtPeriodEnd: true, reason: 'Not needed anymore' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('at the end of current period');
    });

    it('should cancel subscription immediately', async () => {
      const mockSubscription = {
        id: 'sub-123',
        tier: 'basic',
        status: 'active'
      };

      DatabaseService.getUserSubscription.mockResolvedValue(mockSubscription);
      DatabaseService.updateSubscription.mockResolvedValue({
        ...mockSubscription,
        status: 'cancelled'
      });
      DatabaseService.logSubscriptionEvent.mockResolvedValue();

      const response = await request(app)
        .post('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${token}`)
        .send({ cancelAtPeriodEnd: false });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('immediately');
    });

    it('should return 404 for users without subscription', async () => {
      DatabaseService.getUserSubscription.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('No active subscription');
    });

    it('should not allow cancelling free subscription', async () => {
      const freeSubscription = {
        id: 'sub-123',
        tier: 'free',
        status: 'active'
      };

      DatabaseService.getUserSubscription.mockResolvedValue(freeSubscription);

      const response = await request(app)
        .post('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cannot cancel free');
    });
  });

  describe('GET /api/subscriptions/usage', () => {
    it('should return usage statistics', async () => {
      const mockSubscription = {
        tier: 'basic'
      };

      const mockUsage = {
        activeAlerts: 5,
        searchesThisMonth: 150,
        notificationsThisMonth: 75,
        lastSearchRun: '2024-01-01T12:00:00Z'
      };

      DatabaseService.getUserSubscription.mockResolvedValue(mockSubscription);
      DatabaseService.getUserUsageStats.mockResolvedValue(mockUsage);

      const response = await request(app)
        .get('/api/subscriptions/usage')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.usage.tier).toBe('basic');
      expect(response.body.usage.alertsUsed).toBe(5);
      expect(response.body.limits.maxAlerts).toBe(10); // Basic tier limit
      expect(response.body.warnings.alertsNearLimit).toBe(false);
    });

    it('should show warnings when near limits', async () => {
      const mockSubscription = {
        tier: 'basic'
      };

      const mockUsage = {
        activeAlerts: 9, // Near the limit of 10
        searchesThisMonth: 150,
        notificationsThisMonth: 75
      };

      DatabaseService.getUserSubscription.mockResolvedValue(mockSubscription);
      DatabaseService.getUserUsageStats.mockResolvedValue(mockUsage);

      const response = await request(app)
        .get('/api/subscriptions/usage')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.warnings.alertsNearLimit).toBe(true);
    });
  });

  describe('GET /api/subscriptions/billing-history', () => {
    it('should return billing history', async () => {
      const mockHistory = {
        records: [
          {
            id: 'inv-123',
            amount: 9.99,
            currency: 'EUR',
            status: 'paid',
            created_at: '2024-01-01T00:00:00Z'
          }
        ],
        total: 1
      };

      DatabaseService.getUserBillingHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/subscriptions/billing-history')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.billingHistory).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });

    it('should handle pagination', async () => {
      DatabaseService.getUserBillingHistory.mockResolvedValue({
        records: [],
        total: 0
      });

      const response = await request(app)
        .get('/api/subscriptions/billing-history?limit=5&offset=10')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(DatabaseService.getUserBillingHistory).toHaveBeenCalledWith({
        userId: mockUser.id,
        limit: 5,
        offset: 10
      });
    });
  });

  describe('PUT /api/subscriptions/payment-method', () => {
    it('should update payment method successfully', async () => {
      const mockSubscription = {
        id: 'sub-123',
        tier: 'basic'
      };

      const paymentData = {
        paymentMethodId: 'pm_new_123',
        billingAddress: {
          country: 'DE',
          postalCode: '10115'
        }
      };

      DatabaseService.getUserSubscription.mockResolvedValue(mockSubscription);
      DatabaseService.updateSubscription.mockResolvedValue(mockSubscription);
      DatabaseService.logSubscriptionEvent.mockResolvedValue();

      const response = await request(app)
        .put('/api/subscriptions/payment-method')
        .set('Authorization', `Bearer ${token}`)
        .send(paymentData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(DatabaseService.updateSubscription).toHaveBeenCalledWith(
        mockSubscription.id,
        expect.objectContaining({
          paymentMethodId: paymentData.paymentMethodId,
          billingAddress: paymentData.billingAddress
        })
      );
    });

    it('should return 404 for users without subscription', async () => {
      DatabaseService.getUserSubscription.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/subscriptions/payment-method')
        .set('Authorization', `Bearer ${token}`)
        .send({ paymentMethodId: 'pm_test_123' });

      expect(response.status).toBe(404);
    });

    it('should validate payment method ID', async () => {
      const response = await request(app)
        .put('/api/subscriptions/payment-method')
        .set('Authorization', `Bearer ${token}`)
        .send({}); // Missing paymentMethodId

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });
});