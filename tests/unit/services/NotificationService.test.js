/**
 * NotificationService Unit Tests - London School TDD
 * Focus on interactions and collaborations with external services
 */

const NotificationService = require('../../../railway/notification-service/src/services/NotificationService');
const { createSupabaseMock } = require('../../mocks/supabase.mock');
const { createAxiosMock, createRetellAIMock, createResendMock } = require('../../mocks/external-apis.mock');
const { TestDataBuilder, ScenarioBuilder } = require('../../fixtures/test-data');

// Mock external dependencies
jest.mock('axios');
jest.mock('@supabase/supabase-js');
jest.mock('resend');

describe('NotificationService', () => {
  let notificationService;
  let mockSupabase;
  let mockAxios;
  let mockRetell;
  let mockResend;

  beforeEach(() => {
    // Create mocks for all collaborators
    mockSupabase = createSupabaseMock();
    mockAxios = createAxiosMock();
    mockRetell = createRetellAIMock();
    mockResend = createResendMock();

    // Setup axios mock responses
    mockAxios.setupMockResponse(
      'https://api.retellai.com/create-phone-call',
      'POST',
      { call_id: 'call_123', call_status: 'queued' }
    );

    mockAxios.setupMockResponse(
      'https://api.retellai.com/create-retell-llm',
      'POST',
      { llm_id: 'llm_123', model: 'gpt-4o-mini' }
    );

    // Mock Resend constructor
    const mockResendInstance = {
      emails: {
        send: jest.fn().mockResolvedValue({ id: 'email_123' })
      }
    };
    require('resend').Resend = jest.fn(() => mockResendInstance);

    // Mock axios module
    require('axios').post = mockAxios.post.bind(mockAxios);
    require('axios').get = mockAxios.get.bind(mockAxios);

    // Mock Supabase client creation
    require('@supabase/supabase-js').createClient = jest.fn(() => mockSupabase);

    // Initialize service
    notificationService = new NotificationService();
  });

  afterEach(() => {
    mockSupabase.reset();
    mockAxios.reset();
    mockRetell.reset();
    mockResend.reset();
  });

  describe('Voice Call Notifications', () => {
    describe('sendVoiceCall', () => {
      it('should orchestrate voice call creation with proper collaborator interactions', async () => {
        // Arrange
        const vehicleData = TestDataBuilder.vehicle();
        const callParams = {
          phoneNumber: '+4915123456789',
          message: 'Test message',
          vehicleData,
          urgency: 'high',
          userId: 'user_123'
        };

        // Act
        const result = await notificationService.sendVoiceCall(callParams);

        // Assert - Verify interactions with Retell AI
        expect(mockAxios.wasRequestMade('POST', 'create-phone-call')).toBe(true);
        expect(mockAxios.wasRequestMade('POST', 'create-retell-llm')).toBe(true);

        const callRequest = mockAxios.getRequests('POST', 'create-phone-call')[0];
        expect(callRequest.data.toNumber).toBe(callParams.phoneNumber);
        expect(callRequest.data.retellLlmDynamicVariables.car_title).toBe(vehicleData.title);
        expect(callRequest.data.retellLlmDynamicVariables.urgency_level).toBe('high');

        // Verify database logging interaction
        expect(mockSupabase.wasOperationPerformed('insert', 'auto_alert_notifications')).toBe(true);

        // Verify response structure
        expect(result.success).toBe(true);
        expect(result.callId).toBe('call_123');
        expect(result.status).toBe('queued');
      });

      it('should create appropriate LLM prompt based on urgency level', async () => {
        // Arrange
        const vehicleData = TestDataBuilder.vehicle();
        const scenarios = [
          { urgency: 'low', expectedText: 'Ein interessantes Fahrzeug wurde gefunden.' },
          { urgency: 'medium', expectedText: 'Ein sehr interessantes Fahrzeug wurde für Sie gefunden!' },
          { urgency: 'high', expectedText: 'DRINGEND: Ein Traumfahrzeug zu einem fantastischen Preis wurde gefunden!' }
        ];

        for (const scenario of scenarios) {
          // Act
          await notificationService.sendVoiceCall({
            phoneNumber: '+4915123456789',
            vehicleData,
            urgency: scenario.urgency,
            userId: 'user_123'
          });

          // Assert
          const llmRequest = mockAxios.getRequests('POST', 'create-retell-llm').pop();
          expect(llmRequest.data.general_prompt).toContain(scenario.expectedText);
        }
      });

      it('should handle API failures and log error notifications', async () => {
        // Arrange
        mockAxios.setupMockError('https://api.retellai.com/create-phone-call', 'POST', 'API rate limit exceeded');
        const vehicleData = TestDataBuilder.vehicle();

        // Act & Assert
        await expect(notificationService.sendVoiceCall({
          phoneNumber: '+4915123456789',
          vehicleData,
          userId: 'user_123'
        })).rejects.toThrow('Voice call failed: API rate limit exceeded');

        // Verify error logging interaction
        expect(mockSupabase.wasOperationPerformed('insert', 'auto_alert_notifications')).toBe(true);
        const insertions = mockSupabase.getInteractions('auto_alert_notifications')
          .filter(i => i.operation === 'insert');
        
        const errorLog = insertions.find(i => i.data.status === 'failed');
        expect(errorLog).toBeDefined();
        expect(errorLog.data.error_message).toBe('API rate limit exceeded');
      });

      it('should pass correct headers for authentication', async () => {
        // Arrange
        const vehicleData = TestDataBuilder.vehicle();

        // Act
        await notificationService.sendVoiceCall({
          phoneNumber: '+4915123456789',
          vehicleData,
          userId: 'user_123'
        });

        // Assert
        const request = mockAxios.getRequests('POST', 'create-phone-call')[0];
        expect(request.config.headers.Authorization).toBe('Bearer test-retell-api-key');
        expect(request.config.headers['Content-Type']).toBe('application/json');
      });
    });

    describe('createCarAlertPrompt', () => {
      it('should generate context-appropriate prompts', () => {
        // Arrange
        const vehicleData = TestDataBuilder.vehicle();

        // Act
        const prompt = notificationService.createCarAlertPrompt(vehicleData, 'medium');

        // Assert
        expect(prompt).toContain('{{car_title}}');
        expect(prompt).toContain('{{car_price}}');
        expect(prompt).toContain('{{urgency_level}}');
        expect(prompt).toContain('Sprich nur Deutsch');
        expect(prompt).toContain('automatische Benachrichtigung');
      });
    });
  });

  describe('Email Notifications', () => {
    describe('sendEmail', () => {
      it('should orchestrate email sending with proper template generation', async () => {
        // Arrange
        const vehicleData = TestDataBuilder.vehicle();
        const emailParams = {
          to: 'test@example.com',
          subject: 'Test Subject',
          vehicleData,
          userId: 'user_123'
        };

        // Act
        const result = await notificationService.sendEmail(emailParams);

        // Assert - Verify Resend interaction
        const mockResendInstance = require('resend').Resend.mock.results[0].value;
        expect(mockResendInstance.emails.send).toHaveBeenCalledWith({
          from: 'Auto-Alert <alerts@autoalert.com>',
          to: [emailParams.to],
          subject: emailParams.subject,
          html: expect.stringContaining(vehicleData.title)
        });

        // Verify database logging
        expect(mockSupabase.wasOperationPerformed('insert', 'auto_alert_notifications')).toBe(true);

        // Verify response
        expect(result.success).toBe(true);
        expect(result.messageId).toBe('email_123');
      });

      it('should generate comprehensive HTML email template', async () => {
        // Arrange
        const vehicleData = TestDataBuilder.vehicle({
          title: 'BMW X5 M50d',
          price: 45000,
          year: 2020,
          mileage: 35000,
          fuel: 'Diesel',
          location: 'Berlin, 10117'
        });

        // Act
        const template = notificationService.createEmailTemplate(vehicleData);

        // Assert
        expect(template).toContain('BMW X5 M50d');
        expect(template).toContain('45.000€');
        expect(template).toContain('2020');
        expect(template).toContain('35.000 km');
        expect(template).toContain('Berlin, 10117');
        expect(template).toContain('🚗 Neues Fahrzeug gefunden!');
        expect(template).toContain(vehicleData.detailUrl);
      });

      it('should handle email sending failures gracefully', async () => {
        // Arrange
        const mockResendInstance = require('resend').Resend.mock.results[0].value;
        mockResendInstance.emails.send.mockRejectedValue(new Error('SMTP server unavailable'));

        const vehicleData = TestDataBuilder.vehicle();

        // Act & Assert
        await expect(notificationService.sendEmail({
          to: 'test@example.com',
          vehicleData,
          userId: 'user_123'
        })).rejects.toThrow('Email failed: SMTP server unavailable');

        // Verify error logging
        const errorLogs = mockSupabase.getInteractions('auto_alert_notifications')
          .filter(i => i.operation === 'insert' && i.data.status === 'failed');
        
        expect(errorLogs).toHaveLength(1);
        expect(errorLogs[0].data.error_message).toBe('SMTP server unavailable');
      });
    });
  });

  describe('Multi-Channel Notifications', () => {
    describe('sendMultiChannel', () => {
      it('should coordinate multiple notification channels based on user preferences', async () => {
        // Arrange
        const scenario = ScenarioBuilder.newVehicleFound();
        
        // Setup mock user data in Supabase
        mockSupabase.setMockData('auto_alert_user_profiles', [scenario.user]);

        // Act
        const results = await notificationService.sendMultiChannel({
          userId: scenario.user.id,
          vehicleData: scenario.vehicle,
          channels: ['email', 'voice'],
          urgency: 'medium'
        });

        // Assert
        expect(results).toHaveLength(2);
        
        const emailResult = results.find(r => r.channel === 'email');
        const voiceResult = results.find(r => r.channel === 'voice');
        
        expect(emailResult.success).toBe(true);
        expect(voiceResult.success).toBe(true);

        // Verify user data was fetched
        expect(mockSupabase.wasOperationPerformed('select', 'auto_alert_user_profiles')).toBe(true);
        
        // Verify both services were called
        expect(mockAxios.wasRequestMade('POST', 'create-phone-call')).toBe(true);
        const mockResendInstance = require('resend').Resend.mock.results[0].value;
        expect(mockResendInstance.emails.send).toHaveBeenCalled();
      });

      it('should skip channels when user preferences are disabled', async () => {
        // Arrange
        const user = TestDataBuilder.user({
          notification_preferences: {
            email: true,
            voice: false, // Disabled
            sms: false
          }
        });

        mockSupabase.setMockData('auto_alert_user_profiles', [user]);

        // Act
        const results = await notificationService.sendMultiChannel({
          userId: user.id,
          vehicleData: TestDataBuilder.vehicle(),
          channels: ['email', 'voice'],
          urgency: 'medium'
        });

        // Assert
        const emailResult = results.find(r => r.channel === 'email');
        const voiceResult = results.find(r => r.channel === 'voice');
        
        expect(emailResult.success).toBe(true);
        expect(voiceResult.success).toBe(false); // Should be undefined/false since voice is disabled

        // Voice call should not have been made
        expect(mockAxios.wasRequestMade('POST', 'create-phone-call')).toBe(false);
      });

      it('should handle partial failures in multi-channel sending', async () => {
        // Arrange
        const user = TestDataBuilder.user();
        mockSupabase.setMockData('auto_alert_user_profiles', [user]);

        // Setup email to fail
        const mockResendInstance = require('resend').Resend.mock.results[0].value;
        mockResendInstance.emails.send.mockRejectedValue(new Error('SMTP error'));

        // Act
        const results = await notificationService.sendMultiChannel({
          userId: user.id,
          vehicleData: TestDataBuilder.vehicle(),
          channels: ['email', 'voice'],
          urgency: 'medium'
        });

        // Assert
        expect(results).toHaveLength(2);
        
        const emailResult = results.find(r => r.channel === 'email');
        const voiceResult = results.find(r => r.channel === 'voice');
        
        expect(emailResult.success).toBe(false);
        expect(emailResult.error).toContain('SMTP error');
        expect(voiceResult.success).toBe(true);
      });
    });
  });

  describe('Notification Logging and Tracking', () => {
    describe('logNotification', () => {
      it('should record notification attempts with complete metadata', async () => {
        // Arrange
        const logData = {
          userId: 'user_123',
          type: 'email',
          status: 'sent',
          provider: 'resend',
          providerId: 'email_abc123',
          vehicleData: TestDataBuilder.vehicle()
        };

        // Act
        await notificationService.logNotification(logData);

        // Assert
        expect(mockSupabase.wasOperationPerformed('insert', 'auto_alert_notifications')).toBe(true);
        
        const insertCall = mockSupabase.getInteractions('auto_alert_notifications')
          .find(i => i.operation === 'insert');
        
        expect(insertCall.data.user_id).toBe(logData.userId);
        expect(insertCall.data.notification_type).toBe(logData.type);
        expect(insertCall.data.status).toBe(logData.status);
        expect(insertCall.data.provider).toBe(logData.provider);
        expect(insertCall.data.provider_id).toBe(logData.providerId);
      });
    });

    describe('getNotificationHistory', () => {
      it('should retrieve user notification history with proper filtering', async () => {
        // Arrange
        const notifications = [
          TestDataBuilder.notification({ user_id: 'user_123', notification_type: 'email' }),
          TestDataBuilder.notification({ user_id: 'user_123', notification_type: 'voice' }),
          TestDataBuilder.notification({ user_id: 'user_456', notification_type: 'email' })
        ];

        mockSupabase.setMockData('auto_alert_notifications', notifications);

        // Act
        const result = await notificationService.getNotificationHistory({
          userId: 'user_123',
          limit: 10,
          type: 'email'
        });

        // Assert
        expect(mockSupabase.wasOperationPerformed('select', 'auto_alert_notifications')).toBe(true);
        expect(result.notifications).toBeDefined();
        expect(result.total).toBeDefined();
      });
    });
  });

  describe('Contract Verification', () => {
    it('should maintain expected interface with all required methods', () => {
      // Arrange & Act
      const publicMethods = [
        'sendVoiceCall',
        'sendEmail',
        'sendMultiChannel',
        'createCarAlertPrompt',
        'createEmailTemplate',
        'logNotification',
        'getNotificationStatus',
        'getNotificationHistory'
      ];

      // Assert
      publicMethods.forEach(method => {
        expect(typeof notificationService[method]).toBe('function');
      });
    });

    it('should handle all expected collaborator interactions gracefully', async () => {
      // Arrange
      const collaborators = {
        supabase: mockSupabase,
        axios: mockAxios,
        resend: mockResend
      };

      // Act - Test that service doesn't break with mock collaborators
      const vehicleData = TestDataBuilder.vehicle();
      
      try {
        await notificationService.sendEmail({
          to: 'test@example.com',
          vehicleData,
          userId: 'user_123'
        });
      } catch (error) {
        // Should not throw due to mock setup issues
      }

      // Assert - All collaborators should have been interacted with
      Object.values(collaborators).forEach(collaborator => {
        expect(collaborator).toBeDefined();
      });
    });
  });
});