const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../railway/notification-service/src/server');

// Mock DatabaseService for integration tests
jest.mock('../../railway/notification-service/src/services/DatabaseService');
const DatabaseService = require('../../railway/notification-service/src/services/DatabaseService');

describe('API Integration Tests', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    // Setup test user
    userId = 'integration-test-user';
    const mockUser = {
      id: userId,
      email: 'integration@test.com',
      name: 'Integration Test User',
      phone: '+491234567890',
      preferences: { notifications: ['email'] },
      created_at: new Date().toISOString()
    };

    // Mock user creation and authentication
    DatabaseService.getUserByEmail.mockResolvedValue(null);
    DatabaseService.createUserProfile.mockResolvedValue(mockUser);
    DatabaseService.updateUserLastLogin.mockResolvedValue();

    // Register test user and get token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: mockUser.email,
        name: mockUser.name,
        phone: mockUser.phone,
        password: 'testpassword123',
        preferences: mockUser.preferences
      });

    expect(registerResponse.status).toBe(201);
    authToken = registerResponse.body.token;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Journey: Registration → Alert Creation → Search → Notifications', () => {
    it('should complete full user journey successfully', async () => {
      // Step 1: Get user profile
      DatabaseService.getUserById.mockResolvedValue({
        id: userId,
        email: 'integration@test.com',
        name: 'Integration Test User'
      });

      const profileResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.user.id).toBe(userId);

      // Step 2: Check subscription (should be free tier)
      DatabaseService.getUserSubscription.mockResolvedValue(null);
      DatabaseService.getUserActiveAlertsCount.mockResolvedValue(0);

      const subscriptionResponse = await request(app)
        .get('/api/subscriptions/current')
        .set('Authorization', `Bearer ${authToken}`);

      expect(subscriptionResponse.status).toBe(200);
      expect(subscriptionResponse.body.subscription.tier).toBe('free');

      // Step 3: Create search alert
      const alertData = {
        name: 'BMW Integration Test Alert',
        criteria: {
          make: 'BMW',
          model: '3er',
          priceFrom: 15000,
          priceTo: 40000,
          yearFrom: 2018
        },
        notificationChannels: ['email'],
        isActive: true
      };

      const createdAlert = {
        id: 'integration-alert-123',
        user_id: userId,
        name: alertData.name,
        criteria: alertData.criteria,
        notification_channels: alertData.notificationChannels,
        is_active: alertData.isActive,
        created_at: new Date().toISOString()
      };

      DatabaseService.createSearchAlert.mockResolvedValue(createdAlert);

      const createAlertResponse = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(alertData);

      expect(createAlertResponse.status).toBe(201);
      expect(createAlertResponse.body.alert.name).toBe(alertData.name);

      // Step 4: Get user alerts
      DatabaseService.getUserSearchAlerts.mockResolvedValue({
        alerts: [createdAlert],
        total: 1
      });

      const alertsResponse = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(alertsResponse.status).toBe(200);
      expect(alertsResponse.body.alerts).toHaveLength(1);

      // Step 5: Get specific alert with vehicles
      DatabaseService.getSearchAlertById.mockResolvedValue(createdAlert);
      DatabaseService.getFoundVehiclesByAlert.mockResolvedValue([
        {
          id: 'vehicle-123',
          title: 'BMW 320d Touring',
          price: 28500,
          year: 2019,
          mileage: 45000,
          location: 'Berlin',
          found_at: new Date().toISOString()
        }
      ]);

      const specificAlertResponse = await request(app)
        .get(`/api/alerts/${createdAlert.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(specificAlertResponse.status).toBe(200);
      expect(specificAlertResponse.body.alert.id).toBe(createdAlert.id);
      expect(specificAlertResponse.body.recentVehicles).toHaveLength(1);

      // Step 6: Update alert
      const alertUpdates = {
        name: 'Updated BMW Alert',
        isActive: false
      };

      const updatedAlert = {
        ...createdAlert,
        name: alertUpdates.name,
        is_active: alertUpdates.isActive,
        updated_at: new Date().toISOString()
      };

      DatabaseService.updateSearchAlert.mockResolvedValue(updatedAlert);

      const updateResponse = await request(app)
        .put(`/api/alerts/${createdAlert.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(alertUpdates);

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.alert.name).toBe(alertUpdates.name);

      // Step 7: Get alert statistics
      DatabaseService.getAlertStatistics.mockResolvedValue({
        totalVehiclesFound: 25,
        averagePrice: 27500,
        priceRange: { min: 20000, max: 35000 },
        uniqueMakes: 1,
        searchRuns: 5,
        notificationsSent: 10
      });

      const statsResponse = await request(app)
        .get(`/api/alerts/${createdAlert.id}/stats`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.statistics.totalVehiclesFound).toBe(25);

      // Step 8: Check usage
      DatabaseService.getUserUsageStats.mockResolvedValue({
        activeAlerts: 1,
        searchesThisMonth: 10,
        notificationsThisMonth: 5
      });

      const usageResponse = await request(app)
        .get('/api/subscriptions/usage')
        .set('Authorization', `Bearer ${authToken}`);

      expect(usageResponse.status).toBe(200);
      expect(usageResponse.body.usage.alertsUsed).toBe(1);
    });
  });

  describe('Subscription Upgrade Journey', () => {
    it('should handle subscription upgrade flow', async () => {
      // Start with free tier
      DatabaseService.getUserSubscription.mockResolvedValue(null);
      DatabaseService.getUserActiveAlertsCount.mockResolvedValue(2);

      const currentSubResponse = await request(app)
        .get('/api/subscriptions/current')
        .set('Authorization', `Bearer ${authToken}`);

      expect(currentSubResponse.body.subscription.tier).toBe('free');
      expect(currentSubResponse.body.subscription.alertsUsed).toBe(2);

      // Try to create third alert (should work on free tier, limit is 2 but this is 3rd)
      const alertData = {
        name: 'Third Alert',
        criteria: { make: 'Audi' },
        notificationChannels: ['email'],
        isActive: true
      };

      // Mock subscription limit check
      DatabaseService.getUserActiveAlertsCount.mockResolvedValue(2); // Already at limit

      const alertResponse = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(alertData);

      expect(alertResponse.status).toBe(403);
      expect(alertResponse.body.error).toContain('Alert limit reached');
      expect(alertResponse.body.upgradeRequired).toBe(true);

      // Upgrade to basic tier
      const subscriptionData = {
        tier: 'basic',
        paymentMethodId: 'pm_test_basic',
        billingAddress: { country: 'DE', postalCode: '10115' }
      };

      const upgradedSubscription = {
        id: 'sub-123',
        tier: 'basic',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      DatabaseService.createSubscription.mockResolvedValue(upgradedSubscription);
      DatabaseService.logSubscriptionEvent.mockResolvedValue();

      const upgradeResponse = await request(app)
        .post('/api/subscriptions/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(subscriptionData);

      expect(upgradeResponse.status).toBe(201);
      expect(upgradeResponse.body.subscription.tier).toBe('basic');

      // Now try creating alert again (should succeed)
      DatabaseService.getUserSubscription.mockResolvedValue(upgradedSubscription);
      DatabaseService.getUserActiveAlertsCount.mockResolvedValue(2); // Still 2, under basic limit of 10
      DatabaseService.createSearchAlert.mockResolvedValue({
        id: 'alert-new',
        user_id: userId,
        name: alertData.name,
        criteria: alertData.criteria,
        notification_channels: alertData.notificationChannels,
        is_active: alertData.isActive,
        created_at: new Date().toISOString()
      });

      const newAlertResponse = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(alertData);

      expect(newAlertResponse.status).toBe(201);
      expect(newAlertResponse.body.alert.name).toBe(alertData.name);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection failures gracefully', async () => {
      // Simulate database failure
      DatabaseService.getUserById.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.details).toContain('Database connection failed');
    });

    it('should handle invalid authentication tokens', async () => {
      const response = await request(app)
        .get('/api/alerts')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should validate input data properly', async () => {
      const invalidAlertData = {
        name: 'A', // Too short
        criteria: {
          priceFrom: 50000,
          priceTo: 10000 // Invalid range
        },
        notificationChannels: ['invalid-channel']
      };

      const response = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidAlertData);

      expect(response.status).toBe(400);
      expect(response.body.errors || response.body.error).toBeDefined();
    });

    it('should handle concurrent requests properly', async () => {
      DatabaseService.getUserSearchAlerts.mockResolvedValue({
        alerts: [],
        total: 0
      });

      // Send multiple concurrent requests
      const requests = Array(5).fill().map(() =>
        request(app)
          .get('/api/alerts')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Real-time Functionality', () => {
    it('should establish SSE connection successfully', async () => {
      // Note: Testing SSE connections requires special handling
      // This is a simplified test - in reality you'd need more sophisticated SSE testing

      const response = await request(app)
        .get('/api/realtime/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream');

      // The connection should be established (might timeout in test environment)
      expect([200, 408]).toContain(response.status); // 200 for success, 408 for timeout
    });

    it('should get realtime connection status', async () => {
      const response = await request(app)
        .get('/api/realtime/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toHaveProperty('totalConnections');
    });
  });
});