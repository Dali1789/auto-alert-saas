/**
 * Webhooks Integration Tests - London School TDD
 * Focus on request/response flows and external service coordination
 */

const request = require('supertest');
const express = require('express');
const webhooksRouter = require('../../railway/notification-service/src/routes/webhooks');
const { createSupabaseMock } = require('../mocks/supabase.mock');
const { createAxiosMock, createResendMock } = require('../mocks/external-apis.mock');
const { TestDataBuilder, ScenarioBuilder } = require('../fixtures/test-data');

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/webhooks', webhooksRouter);
  return app;
}

// Mock dependencies
jest.mock('../../railway/notification-service/src/services/NotificationService');

describe('Webhooks Integration', () => {
  let app;
  let mockSupabase;
  let mockAxios;
  let mockResend;
  let MockNotificationService;

  beforeEach(() => {
    app = createTestApp();
    mockSupabase = createSupabaseMock();
    mockAxios = createAxiosMock();
    mockResend = createResendMock();

    // Mock NotificationService
    const mockNotificationServiceInstance = {
      supabase: mockSupabase,
      sendMultiChannel: jest.fn(),
      sendEmail: jest.fn(),
      sendVoiceCall: jest.fn()
    };

    MockNotificationService = require('../../railway/notification-service/src/services/NotificationService');
    MockNotificationService.mockImplementation(() => mockNotificationServiceInstance);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockSupabase.reset();
  });

  describe('POST /api/webhooks/n8n', () => {
    describe('Authentication and Validation', () => {
      it('should reject requests without webhook secret', async () => {
        // Arrange
        const payload = TestDataBuilder.webhookPayload();

        // Act
        const response = await request(app)
          .post('/api/webhooks/n8n')
          .send(payload);

        // Assert
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      });

      it('should reject requests with invalid webhook secret', async () => {
        // Arrange
        const payload = TestDataBuilder.webhookPayload();

        // Act
        const response = await request(app)
          .post('/api/webhooks/n8n')
          .set('webhook_secret', 'invalid-secret')
          .send(payload);

        // Assert
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      });

      it('should accept requests with valid webhook secret', async () => {
        // Arrange
        const scenario = ScenarioBuilder.newVehicleFound();
        const payload = TestDataBuilder.webhookPayload({
          searchId: scenario.search.id,
          newVehicles: [scenario.vehicle]
        });

        // Setup mock data
        mockSupabase.setMockData('auto_alert_searches', [{
          ...scenario.search,
          auto_alert_user_profiles: scenario.user
        }]);

        mockSupabase.setMockData('auto_alert_results', [
          TestDataBuilder.result({
            search_id: scenario.search.id,
            mobile_ad_id: scenario.vehicle.mobileAdId
          })
        ]);

        const mockService = new MockNotificationService();
        mockService.sendMultiChannel.mockResolvedValue([
          { channel: 'email', success: true },
          { channel: 'voice', success: true }
        ]);

        // Act
        const response = await request(app)
          .post('/api/webhooks/n8n')
          .set('webhook_secret', 'test-webhook-secret')
          .send(payload);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should validate payload structure', async () => {
        // Arrange
        const testCases = [
          { payload: {}, expectedError: 'Invalid payload' },
          { payload: { searchId: 'test' }, expectedError: 'Invalid payload' },
          { payload: { newVehicles: [] }, expectedError: 'Invalid payload' },
          { payload: { searchId: 'test', newVehicles: 'not-array' }, expectedError: 'Invalid payload' }
        ];

        for (const { payload, expectedError } of testCases) {
          // Act
          const response = await request(app)
            .post('/api/webhooks/n8n')
            .set('webhook_secret', 'test-webhook-secret')
            .send(payload);

          // Assert
          expect(response.status).toBe(400);
          expect(response.body.error).toContain(expectedError);
        }
      });
    });

    describe('Vehicle Processing Workflow', () => {
      it('should process new vehicles and trigger notifications', async () => {
        // Arrange
        const scenario = ScenarioBuilder.newVehicleFound();
        const payload = TestDataBuilder.webhookPayload({
          searchId: scenario.search.id,
          newVehicles: [scenario.vehicle]
        });

        // Setup search with user profile
        mockSupabase.setMockData('auto_alert_searches', [{
          ...scenario.search,
          auto_alert_user_profiles: scenario.user
        }]);

        // Mock successful result insertion
        mockSupabase.setMockData('auto_alert_results', [
          TestDataBuilder.result({
            id: 'result_123',
            search_id: scenario.search.id,
            mobile_ad_id: scenario.vehicle.mobileAdId
          })
        ]);

        const mockService = new MockNotificationService();
        mockService.sendMultiChannel.mockResolvedValue([
          { channel: 'email', success: true, result: { messageId: 'email_123' } },
          { channel: 'voice', success: true, result: { callId: 'call_123' } }
        ]);

        // Act
        const response = await request(app)
          .post('/api/webhooks/n8n')
          .set('webhook_secret', 'test-webhook-secret')
          .send(payload);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Processed 1 vehicles');
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].stored).toBe(true);
        expect(response.body.results[0].notifications).toHaveLength(2);

        // Verify database interactions
        expect(mockSupabase.wasOperationPerformed('select', 'auto_alert_searches')).toBe(true);
        expect(mockSupabase.wasOperationPerformed('insert', 'auto_alert_results')).toBe(true);
        expect(mockSupabase.wasOperationPerformed('update', 'auto_alert_results')).toBe(true);

        // Verify notification service was called
        expect(mockService.sendMultiChannel).toHaveBeenCalledWith({
          userId: scenario.user.id,
          vehicleData: expect.objectContaining({
            mobileAdId: scenario.vehicle.mobileAdId,
            title: scenario.vehicle.title,
            location: `${scenario.vehicle.sellerCity}, ${scenario.vehicle.sellerZipcode}`,
            searchName: scenario.search.name
          }),
          channels: scenario.search.notification_methods,
          urgency: expect.any(String)
        });
      });

      it('should calculate urgency based on price ratio', async () => {
        // Arrange
        const testCases = [
          { 
            vehiclePrice: 15000, 
            searchMaxPrice: 30000, 
            expectedUrgency: 'high' // 50% ratio < 70%
          },
          {
            vehiclePrice: 22000,
            searchMaxPrice: 30000,
            expectedUrgency: 'medium' // 73% ratio between 70-90%
          },
          {
            vehiclePrice: 28000,
            searchMaxPrice: 30000,
            expectedUrgency: 'low' // 93% ratio > 90%
          }
        ];

        for (const { vehiclePrice, searchMaxPrice, expectedUrgency } of testCases) {
          const user = TestDataBuilder.user();
          const search = TestDataBuilder.search({ price_max: searchMaxPrice });
          const vehicle = TestDataBuilder.vehicle({ price: vehiclePrice });

          mockSupabase.setMockData('auto_alert_searches', [{
            ...search,
            auto_alert_user_profiles: user
          }]);

          mockSupabase.setMockData('auto_alert_results', [
            TestDataBuilder.result({ id: `result_${vehiclePrice}` })
          ]);

          const mockService = new MockNotificationService();
          mockService.sendMultiChannel.mockResolvedValue([]);

          const payload = TestDataBuilder.webhookPayload({
            searchId: search.id,
            newVehicles: [vehicle]
          });

          // Act
          await request(app)
            .post('/api/webhooks/n8n')
            .set('webhook_secret', 'test-webhook-secret')
            .send(payload);

          // Assert
          expect(mockService.sendMultiChannel).toHaveBeenCalledWith(
            expect.objectContaining({
              urgency: expectedUrgency
            })
          );

          // Reset for next test case
          mockSupabase.reset();
          jest.clearAllMocks();
        }
      });

      it('should handle missing search gracefully', async () => {
        // Arrange
        const payload = TestDataBuilder.webhookPayload({
          searchId: 'non-existent-search',
          newVehicles: [TestDataBuilder.vehicle()]
        });

        // Setup empty search result
        mockSupabase.setMockData('auto_alert_searches', []);

        // Act
        const response = await request(app)
          .post('/api/webhooks/n8n')
          .set('webhook_secret', 'test-webhook-secret')
          .send(payload);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.results[0].stored).toBe(false);
        expect(response.body.results[0].error).toBeDefined();
      });

      it('should process multiple vehicles in batch', async () => {
        // Arrange
        const user = TestDataBuilder.user();
        const search = TestDataBuilder.search();
        const vehicles = [
          TestDataBuilder.vehicle({ mobileAdId: '123', title: 'BMW 1' }),
          TestDataBuilder.vehicle({ mobileAdId: '124', title: 'BMW 2' }),
          TestDataBuilder.vehicle({ mobileAdId: '125', title: 'BMW 3' })
        ];

        mockSupabase.setMockData('auto_alert_searches', [{
          ...search,
          auto_alert_user_profiles: user
        }]);

        // Mock result insertions
        vehicles.forEach((vehicle, index) => {
          mockSupabase.setMockData('auto_alert_results', [
            TestDataBuilder.result({
              id: `result_${index}`,
              mobile_ad_id: vehicle.mobileAdId
            })
          ]);
        });

        const mockService = new MockNotificationService();
        mockService.sendMultiChannel.mockResolvedValue([
          { channel: 'email', success: true }
        ]);

        const payload = TestDataBuilder.webhookPayload({
          searchId: search.id,
          newVehicles: vehicles
        });

        // Act
        const response = await request(app)
          .post('/api/webhooks/n8n')
          .set('webhook_secret', 'test-webhook-secret')
          .send(payload);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Processed 3 vehicles');
        expect(response.body.results).toHaveLength(3);
        expect(mockService.sendMultiChannel).toHaveBeenCalledTimes(3);
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors gracefully', async () => {
        // Arrange
        const payload = TestDataBuilder.webhookPayload();
        
        // Mock database error
        const mockService = new MockNotificationService();
        mockService.supabase.from = jest.fn().mockImplementation(() => ({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: new Error('Database connection failed')
              })
            })
          })
        }));

        // Act
        const response = await request(app)
          .post('/api/webhooks/n8n')
          .set('webhook_secret', 'test-webhook-secret')
          .send(payload);

        // Assert
        expect(response.status).toBe(200); // Should not fail the entire request
        expect(response.body.results[0].stored).toBe(false);
      });

      it('should handle notification failures gracefully', async () => {
        // Arrange
        const scenario = ScenarioBuilder.failedNotification();
        
        mockSupabase.setMockData('auto_alert_searches', [{
          ...scenario.search,
          auto_alert_user_profiles: scenario.user
        }]);

        mockSupabase.setMockData('auto_alert_results', [
          TestDataBuilder.result()
        ]);

        const mockService = new MockNotificationService();
        mockService.sendMultiChannel.mockRejectedValue(
          new Error(scenario.notificationError)
        );

        const payload = TestDataBuilder.webhookPayload({
          searchId: scenario.search.id,
          newVehicles: [scenario.vehicle]
        });

        // Act
        const response = await request(app)
          .post('/api/webhooks/n8n')
          .set('webhook_secret', 'test-webhook-secret')
          .send(payload);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.results[0].stored).toBe(true); // Vehicle stored even if notification failed
        expect(response.body.results[0].error).toBe(scenario.notificationError);
      });

      it('should handle malformed vehicle data', async () => {
        // Arrange
        const payload = {
          searchId: 'test-search',
          newVehicles: [
            { /* missing required fields */ },
            null,
            { mobileAdId: 'valid-123', title: 'Valid Car' }
          ]
        };

        const user = TestDataBuilder.user();
        const search = TestDataBuilder.search({ id: 'test-search' });

        mockSupabase.setMockData('auto_alert_searches', [{
          ...search,
          auto_alert_user_profiles: user
        }]);

        // Act
        const response = await request(app)
          .post('/api/webhooks/n8n')
          .set('webhook_secret', 'test-webhook-secret')
          .send(payload);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.results).toHaveLength(3);
        
        // First two should fail, third should succeed
        expect(response.body.results[0].stored).toBe(false);
        expect(response.body.results[1].stored).toBe(false);
        expect(response.body.results[2].stored).toBe(true);
      });
    });
  });

  describe('POST /api/webhooks/retell/call-status', () => {
    it('should update call status in database', async () => {
      // Arrange
      const callStatusPayload = {
        call_id: 'call_123',
        call_status: 'ended',
        end_reason: 'completed'
      };

      const mockService = new MockNotificationService();

      // Act
      const response = await request(app)
        .post('/api/webhooks/retell/call-status')
        .send(callStatusPayload);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify database update
      expect(mockSupabase.wasOperationPerformed('update', 'auto_alert_notifications')).toBe(true);
    });

    it('should handle different call statuses', async () => {
      // Arrange
      const statusCases = [
        { call_status: 'queued', expectedDbStatus: 'queued' },
        { call_status: 'ringing', expectedDbStatus: 'ringing' },
        { call_status: 'in_progress', expectedDbStatus: 'in_progress' },
        { call_status: 'ended', expectedDbStatus: 'delivered' }
      ];

      for (const { call_status, expectedDbStatus } of statusCases) {
        const payload = {
          call_id: `call_${call_status}`,
          call_status
        };

        // Act
        const response = await request(app)
          .post('/api/webhooks/retell/call-status')
          .send(payload);

        // Assert
        expect(response.status).toBe(200);
        
        // Verify correct status mapping
        const updateCalls = mockSupabase.getInteractions('auto_alert_notifications')
          .filter(i => i.operation === 'update');
        
        const relevantCall = updateCalls.find(call => 
          call.data.status === expectedDbStatus
        );
        expect(relevantCall).toBeDefined();

        // Reset for next iteration
        mockSupabase.reset();
      }
    });
  });

  describe('POST /api/webhooks/test', () => {
    it('should send test email notification', async () => {
      // Arrange
      const testPayload = {
        testEmail: 'test@example.com'
      };

      const mockService = new MockNotificationService();
      mockService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'test_email_123'
      });

      // Act
      const response = await request(app)
        .post('/api/webhooks/test')
        .send(testPayload);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Test notifications sent');
      expect(response.body.testVehicle).toBeDefined();

      // Verify email service was called
      expect(mockService.sendEmail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: '🧪 Auto-Alert Test Notification',
        vehicleData: expect.objectContaining({
          title: 'BMW 740d xDrive Test'
        }),
        userId: 'test-user-id'
      });
    });

    it('should send test voice call notification', async () => {
      // Arrange
      const testPayload = {
        testPhone: '+4915123456789'
      };

      const mockService = new MockNotificationService();
      mockService.sendVoiceCall.mockResolvedValue({
        success: true,
        callId: 'test_call_123'
      });

      // Act
      const response = await request(app)
        .post('/api/webhooks/test')
        .send(testPayload);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify voice call service was called
      expect(mockService.sendVoiceCall).toHaveBeenCalledWith({
        phoneNumber: '+4915123456789',
        message: 'Test-Nachricht für Auto-Alert Service',
        vehicleData: expect.objectContaining({
          title: 'BMW 740d xDrive Test'
        }),
        urgency: 'medium',
        userId: 'test-user-id'
      });
    });

    it('should handle test notification failures', async () => {
      // Arrange
      const testPayload = {
        testEmail: 'test@example.com'
      };

      const mockService = new MockNotificationService();
      mockService.sendEmail.mockRejectedValue(new Error('Test email failed'));

      // Act
      const response = await request(app)
        .post('/api/webhooks/test')
        .send(testPayload);

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test failed');
      expect(response.body.details).toBe('Test email failed');
    });
  });

  describe('GET /api/webhooks/info', () => {
    it('should return webhook service information', async () => {
      // Act
      const response = await request(app)
        .get('/api/webhooks/info');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.service).toBe('Auto-Alert Webhook Service');
      expect(response.body.endpoints).toBeDefined();
      expect(response.body.headers).toBeDefined();
      expect(response.body.example_payload).toBeDefined();
      
      // Verify all expected endpoints are documented
      const expectedEndpoints = [
        'POST /api/webhooks/n8n',
        'POST /api/webhooks/retell/call-status',
        'POST /api/webhooks/test'
      ];
      
      expectedEndpoints.forEach(endpoint => {
        expect(response.body.endpoints[endpoint]).toBeDefined();
      });
    });
  });

  describe('Contract Verification', () => {
    it('should maintain consistent response format across endpoints', async () => {
      // This test ensures all endpoints follow consistent patterns
      const responses = [];

      // Test successful n8n webhook
      const payload = TestDataBuilder.webhookPayload();
      mockSupabase.setMockData('auto_alert_searches', []);

      const n8nResponse = await request(app)
        .post('/api/webhooks/n8n')
        .set('webhook_secret', 'test-webhook-secret')
        .send(payload);
      
      responses.push(n8nResponse.body);

      // Test call status webhook
      const callStatusResponse = await request(app)
        .post('/api/webhooks/retell/call-status')
        .send({ call_id: 'test', call_status: 'ended' });
      
      responses.push(callStatusResponse.body);

      // Verify all responses have success field
      responses.forEach(response => {
        expect(response).toHaveProperty('success');
        expect(typeof response.success).toBe('boolean');
      });
    });

    it('should handle malformed JSON gracefully', async () => {
      // Act
      const response = await request(app)
        .post('/api/webhooks/n8n')
        .set('webhook_secret', 'test-webhook-secret')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      // Assert
      expect(response.status).toBe(400);
    });

    it('should enforce proper content type', async () => {
      // Act
      const response = await request(app)
        .post('/api/webhooks/n8n')
        .set('webhook_secret', 'test-webhook-secret')
        .set('Content-Type', 'text/plain')
        .send('plain text data');

      // Assert
      expect(response.status).toBe(400);
    });
  });
});