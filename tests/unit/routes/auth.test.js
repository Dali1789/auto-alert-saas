const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../railway/notification-service/src/server');

// Mock DatabaseService
jest.mock('../../../railway/notification-service/src/services/DatabaseService');
const DatabaseService = require('../../../railway/notification-service/src/services/DatabaseService');

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    const validUser = {
      email: 'test@example.com',
      name: 'Test User',
      phone: '+491234567890',
      password: 'password123',
      preferences: {
        notifications: ['email', 'sms']
      }
    };

    it('should register a new user successfully', async () => {
      DatabaseService.getUserByEmail.mockResolvedValue(null);
      DatabaseService.createUserProfile.mockResolvedValue({
        id: 'user-123',
        email: validUser.email,
        name: validUser.name,
        phone: validUser.phone,
        preferences: validUser.preferences,
        created_at: new Date().toISOString()
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe(validUser.email);
      expect(response.body.token).toBeDefined();
      expect(DatabaseService.createUserProfile).toHaveBeenCalledWith({
        email: validUser.email,
        name: validUser.name,
        phone: validUser.phone,
        preferences: validUser.preferences
      });
    });

    it('should reject registration with existing email', async () => {
      DatabaseService.getUserByEmail.mockResolvedValue({
        id: 'existing-user',
        email: validUser.email
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const invalidUser = {
        email: 'invalid-email',
        name: 'A', // Too short
        password: '123' // Too short
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should handle database errors gracefully', async () => {
      DatabaseService.getUserByEmail.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/auth/register')
        .send(validUser);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'password123'
    };

    const mockUser = {
      id: 'user-123',
      email: loginData.email,
      name: 'Test User',
      phone: '+491234567890',
      preferences: { notifications: ['email'] }
    };

    it('should login user successfully', async () => {
      DatabaseService.getUserByEmail.mockResolvedValue(mockUser);
      DatabaseService.updateUserLastLogin.mockResolvedValue();

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe(loginData.email);
      expect(response.body.token).toBeDefined();
      expect(DatabaseService.updateUserLastLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it('should reject login with non-existent user', async () => {
      DatabaseService.getUserByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should validate email format', async () => {
      const invalidLogin = {
        email: 'invalid-email',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidLogin);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/auth/me', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      phone: '+491234567890',
      preferences: { notifications: ['email'] },
      created_at: '2024-01-01T00:00:00Z',
      last_login: '2024-01-01T12:00:00Z'
    };

    it('should return user profile with valid token', async () => {
      DatabaseService.getUserById.mockResolvedValue(mockUser);

      const token = jwt.sign(
        { userId: mockUser.id, email: mockUser.email, name: mockUser.name },
        process.env.JWT_SECRET || 'development-jwt-secret-key-change-in-production'
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.id).toBe(mockUser.id);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should handle user not found', async () => {
      DatabaseService.getUserById.mockResolvedValue(null);

      const token = jwt.sign(
        { userId: 'non-existent-user', email: 'test@example.com', name: 'Test User' },
        process.env.JWT_SECRET || 'development-jwt-secret-key-change-in-production'
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/auth/profile', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      phone: '+491234567890',
      preferences: { notifications: ['email'] }
    };

    const token = jwt.sign(
      { userId: mockUser.id, email: mockUser.email, name: mockUser.name },
      process.env.JWT_SECRET || 'development-jwt-secret-key-change-in-production'
    );

    it('should update user profile successfully', async () => {
      const updates = {
        name: 'Updated Name',
        phone: '+499876543210',
        preferences: { notifications: ['email', 'sms'] }
      };

      const updatedUser = { ...mockUser, ...updates, updated_at: new Date().toISOString() };
      DatabaseService.updateUserProfile.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.name).toBe(updates.name);
      expect(DatabaseService.updateUserProfile).toHaveBeenCalledWith(mockUser.id, updates);
    });

    it('should validate phone number format', async () => {
      const invalidUpdates = {
        phone: 'invalid-phone'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidUpdates);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should handle empty update request', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('No valid fields to update');
    });
  });

  describe('POST /api/auth/refresh', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User'
    };

    it('should refresh token successfully', async () => {
      const token = jwt.sign(
        { userId: mockUser.id, email: mockUser.email, name: mockUser.name },
        process.env.JWT_SECRET || 'development-jwt-secret-key-change-in-production'
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.token).not.toBe(token); // Should be a new token
    });

    it('should require valid token for refresh', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});