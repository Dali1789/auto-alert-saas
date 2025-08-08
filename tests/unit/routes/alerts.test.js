const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../railway/notification-service/src/server');

// Mock DatabaseService
jest.mock('../../../railway/notification-service/src/services/DatabaseService');
const DatabaseService = require('../../../railway/notification-service/src/services/DatabaseService');

describe('Alerts Routes', () => {
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

  describe('POST /api/alerts', () => {
    const validAlert = {
      name: 'BMW 3er Alert',
      criteria: {
        make: 'BMW',
        model: '3er',
        priceFrom: 10000,
        priceTo: 50000,
        yearFrom: 2015,
        yearTo: 2023
      },
      notificationChannels: ['email', 'sms'],
      isActive: true
    };

    it('should create alert successfully', async () => {
      const createdAlert = {
        id: 'alert-123',
        user_id: mockUser.id,
        name: validAlert.name,
        criteria: validAlert.criteria,
        notification_channels: validAlert.notificationChannels,
        is_active: validAlert.isActive,
        created_at: new Date().toISOString()
      };

      DatabaseService.createSearchAlert.mockResolvedValue(createdAlert);

      const response = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send(validAlert);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.alert.name).toBe(validAlert.name);
      expect(DatabaseService.createSearchAlert).toHaveBeenCalledWith({
        userId: mockUser.id,
        ...validAlert
      });
    });

    it('should validate price range', async () => {
      const invalidAlert = {
        ...validAlert,
        criteria: {
          ...validAlert.criteria,
          priceFrom: 50000,
          priceTo: 10000 // Invalid: priceFrom > priceTo
        }
      };

      const response = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidAlert);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Price from cannot be greater than price to');
    });

    it('should validate year range', async () => {
      const invalidAlert = {
        ...validAlert,
        criteria: {
          ...validAlert.criteria,
          yearFrom: 2023,
          yearTo: 2015 // Invalid: yearFrom > yearTo
        }
      };

      const response = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidAlert);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Year from cannot be greater than year to');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/alerts')
        .send(validAlert);

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const incompleteAlert = {
        criteria: {},
        notificationChannels: []
      };

      const response = await request(app)
        .post('/api/alerts')
        .set('Authorization', `Bearer ${token}`)
        .send(incompleteAlert);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/alerts', () => {
    it('should get user alerts successfully', async () => {
      const mockAlerts = {
        alerts: [
          {
            id: 'alert-1',
            name: 'BMW Alert',
            criteria: { make: 'BMW' },
            notification_channels: ['email'],
            is_active: true,
            created_at: '2024-01-01T00:00:00Z'
          }
        ],
        total: 1
      };

      DatabaseService.getUserSearchAlerts.mockResolvedValue(mockAlerts);

      const response = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.alerts).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });

    it('should handle pagination parameters', async () => {
      DatabaseService.getUserSearchAlerts.mockResolvedValue({
        alerts: [],
        total: 0
      });

      const response = await request(app)
        .get('/api/alerts?page=2&limit=5&active=true')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(DatabaseService.getUserSearchAlerts).toHaveBeenCalledWith({
        userId: mockUser.id,
        limit: 5,
        offset: 5,
        active: true
      });
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/alerts?page=0&limit=101') // Invalid page and limit
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/alerts/:id', () => {
    const alertId = 'alert-123';
    
    it('should get specific alert successfully', async () => {
      const mockAlert = {
        id: alertId,
        name: 'Test Alert',
        criteria: { make: 'BMW' },
        notification_channels: ['email'],
        is_active: true,
        created_at: '2024-01-01T00:00:00Z'
      };

      const mockVehicles = [
        {
          id: 'vehicle-1',
          title: 'BMW 320d',
          price: 25000,
          year: 2020,
          found_at: '2024-01-01T12:00:00Z'
        }
      ];

      DatabaseService.getSearchAlertById.mockResolvedValue(mockAlert);
      DatabaseService.getFoundVehiclesByAlert.mockResolvedValue(mockVehicles);

      const response = await request(app)
        .get(`/api/alerts/${alertId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.alert.id).toBe(alertId);
      expect(response.body.recentVehicles).toHaveLength(1);
    });

    it('should return 404 for non-existent alert', async () => {
      DatabaseService.getSearchAlertById.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/alerts/${alertId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('PUT /api/alerts/:id', () => {
    const alertId = 'alert-123';

    it('should update alert successfully', async () => {
      const existingAlert = {
        id: alertId,
        name: 'Old Name',
        user_id: mockUser.id
      };

      const updates = {
        name: 'New Name',
        isActive: false
      };

      const updatedAlert = {
        ...existingAlert,
        name: updates.name,
        is_active: updates.isActive,
        updated_at: new Date().toISOString()
      };

      DatabaseService.getSearchAlertById.mockResolvedValue(existingAlert);
      DatabaseService.updateSearchAlert.mockResolvedValue(updatedAlert);

      const response = await request(app)
        .put(`/api/alerts/${alertId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.alert.name).toBe(updates.name);
    });

    it('should return 404 for non-existent alert', async () => {
      DatabaseService.getSearchAlertById.mockResolvedValue(null);

      const response = await request(app)
        .put(`/api/alerts/${alertId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/alerts/:id', () => {
    const alertId = 'alert-123';

    it('should delete alert successfully', async () => {
      const existingAlert = {
        id: alertId,
        user_id: mockUser.id
      };

      DatabaseService.getSearchAlertById.mockResolvedValue(existingAlert);
      DatabaseService.deleteSearchAlert.mockResolvedValue();

      const response = await request(app)
        .delete(`/api/alerts/${alertId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(DatabaseService.deleteSearchAlert).toHaveBeenCalledWith(alertId);
    });

    it('should return 404 for non-existent alert', async () => {
      DatabaseService.getSearchAlertById.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/alerts/${alertId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/alerts/:id/search', () => {
    const alertId = 'alert-123';

    it('should trigger manual search successfully', async () => {
      const mockAlert = {
        id: alertId,
        user_id: mockUser.id,
        is_active: true,
        criteria: { make: 'BMW' }
      };

      DatabaseService.getSearchAlertById.mockResolvedValue(mockAlert);
      
      // Mock the search function (this would need proper implementation)
      const response = await request(app)
        .post(`/api/alerts/${alertId}/search`)
        .set('Authorization', `Bearer ${token}`);

      // This test would need more sophisticated mocking of the search process
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not allow search on inactive alert', async () => {
      const mockAlert = {
        id: alertId,
        user_id: mockUser.id,
        is_active: false
      };

      DatabaseService.getSearchAlertById.mockResolvedValue(mockAlert);

      const response = await request(app)
        .post(`/api/alerts/${alertId}/search`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('inactive alert');
    });
  });

  describe('GET /api/alerts/:id/stats', () => {
    const alertId = 'alert-123';

    it('should get alert statistics successfully', async () => {
      const mockAlert = {
        id: alertId,
        user_id: mockUser.id,
        last_run: '2024-01-01T12:00:00Z'
      };

      const mockStats = {
        totalVehiclesFound: 50,
        averagePrice: 25000,
        priceRange: { min: 15000, max: 35000 },
        uniqueMakes: 3,
        searchRuns: 10,
        notificationsSent: 25
      };

      DatabaseService.getSearchAlertById.mockResolvedValue(mockAlert);
      DatabaseService.getAlertStatistics.mockResolvedValue(mockStats);

      const response = await request(app)
        .get(`/api/alerts/${alertId}/stats`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.statistics.totalVehiclesFound).toBe(50);
    });

    it('should return 404 for non-existent alert', async () => {
      DatabaseService.getSearchAlertById.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/alerts/${alertId}/stats`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });
});