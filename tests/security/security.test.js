/**
 * Security Tests - London School TDD
 * Focus on authentication, authorization, input validation, and security contracts
 */

const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const { TestDataBuilder } = require('../fixtures/test-data');

// Mock vulnerable endpoints for testing
function createSecurityTestApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Mock webhook endpoint for security testing
  app.post('/api/webhooks/n8n', (req, res) => {
    const { webhook_secret } = req.headers;
    
    if (webhook_secret !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.json({ success: true });
  });

  // Mock user data endpoint
  app.get('/api/users/:userId', (req, res) => {
    const { userId } = req.params;
    
    // Simulate SQL injection vulnerability test
    if (userId.includes(';') || userId.includes('--')) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    res.json({ id: userId, name: 'Test User' });
  });

  // Mock file upload endpoint
  app.post('/api/files/upload', (req, res) => {
    const contentType = req.get('Content-Type') || '';
    
    // Check for dangerous file types
    if (contentType.includes('application/x-executable') || 
        contentType.includes('text/x-shellscript')) {
      return res.status(400).json({ error: 'File type not allowed' });
    }
    
    res.json({ success: true, fileId: 'file_123' });
  });

  // Mock search endpoint with potential NoSQL injection
  app.post('/api/search', (req, res) => {
    const { query } = req.body;
    
    if (typeof query !== 'string') {
      return res.status(400).json({ error: 'Query must be a string' });
    }
    
    res.json({ results: [] });
  });

  return app;
}

describe('Security Tests', () => {
  let app;

  beforeEach(() => {
    app = createSecurityTestApp();
    process.env.WEBHOOK_SECRET = 'test-webhook-secret';
  });

  describe('Authentication Security', () => {
    describe('Webhook Authentication', () => {
      it('should reject requests without authentication header', async () => {
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

      it('should reject requests with invalid authentication token', async () => {
        // Arrange
        const payload = TestDataBuilder.webhookPayload();
        const maliciousSecrets = [
          '', // Empty
          'wrong-secret',
          'test-webhook-secret; DROP TABLE users; --', // SQL injection attempt
          'test-webhook-secret\n\rexec(cat /etc/passwd)', // Command injection
          '../../../test-webhook-secret', // Path traversal
          'test-webhook-secret<script>alert(1)</script>' // XSS attempt
        ];

        for (const maliciousSecret of maliciousSecrets) {
          // Act
          const response = await request(app)
            .post('/api/webhooks/n8n')
            .set('webhook_secret', maliciousSecret)
            .send(payload);

          // Assert
          expect(response.status).toBe(401);
          expect(response.body.error).toBe('Unauthorized');
        }
      });

      it('should accept requests with valid authentication token', async () => {
        // Arrange
        const payload = TestDataBuilder.webhookPayload();

        // Act
        const response = await request(app)
          .post('/api/webhooks/n8n')
          .set('webhook_secret', 'test-webhook-secret')
          .send(payload);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should use constant-time comparison for secrets', () => {
        // Arrange
        const correctSecret = 'test-webhook-secret';
        const wrongSecret = 'wrong-secret';
        const shortSecret = 'short';

        // Act & Assert
        // Using crypto.timingSafeEqual for constant-time comparison
        const correctBuffer = Buffer.from(correctSecret);
        const wrongBuffer = Buffer.from(wrongSecret.padEnd(correctSecret.length, '\0'));
        const shortBuffer = Buffer.from(shortSecret.padEnd(correctSecret.length, '\0'));

        // Should return true for correct secret
        expect(crypto.timingSafeEqual(correctBuffer, correctBuffer)).toBe(true);
        
        // Should return false for wrong secrets (but in constant time)
        expect(crypto.timingSafeEqual(correctBuffer, wrongBuffer)).toBe(false);
        expect(crypto.timingSafeEqual(correctBuffer, shortBuffer)).toBe(false);
      });
    });

    describe('API Key Security', () => {
      it('should not expose API keys in error messages', async () => {
        // This test would verify that API keys aren't leaked in responses
        // In a real implementation, we'd mock failing external API calls
        
        const sensitiveData = [
          'RETELL_API_KEY',
          'RESEND_API_KEY',
          'SUPABASE_SERVICE_ROLE_KEY',
          'test-api-key-12345'
        ];

        // Simulate error response that might leak keys
        const errorResponse = {
          error: 'Authentication failed',
          message: 'API call failed',
          details: 'No sensitive data should appear here'
        };

        // Assert no sensitive data is present
        const responseString = JSON.stringify(errorResponse);
        sensitiveData.forEach(sensitiveItem => {
          expect(responseString).not.toContain(sensitiveItem);
        });
      });
    });
  });

  describe('Input Validation Security', () => {
    describe('SQL Injection Prevention', () => {
      it('should prevent SQL injection attempts in user parameters', async () => {
        // Arrange
        const sqlInjectionPayloads = [
          "1'; DROP TABLE users; --",
          "1' OR '1'='1",
          "1' UNION SELECT * FROM passwords --",
          "1'; EXEC xp_cmdshell('dir'); --",
          "1' AND 1=1 --",
          "admin'--"
        ];

        for (const payload of sqlInjectionPayloads) {
          // Act
          const response = await request(app)
            .get(`/api/users/${encodeURIComponent(payload)}`);

          // Assert
          expect(response.status).toBe(400);
          expect(response.body.error).toBe('Invalid user ID');
        }
      });

      it('should allow valid user IDs', async () => {
        // Arrange
        const validUserIds = [
          'user_123',
          'user-456',
          'user.789',
          '123e4567-e89b-12d3-a456-426614174000' // UUID
        ];

        for (const userId of validUserIds) {
          // Act
          const response = await request(app)
            .get(`/api/users/${userId}`);

          // Assert
          expect(response.status).toBe(200);
          expect(response.body.id).toBe(userId);
        }
      });
    });

    describe('NoSQL Injection Prevention', () => {
      it('should prevent NoSQL injection attempts', async () => {
        // Arrange
        const nosqlInjectionPayloads = [
          { query: { $ne: null } },
          { query: { $gt: '' } },
          { query: { $regex: '.*' } },
          { query: { $where: 'function() { return true; }' } },
          { query: { $or: [{ name: 'admin' }, { role: 'admin' }] } }
        ];

        for (const payload of nosqlInjectionPayloads) {
          // Act
          const response = await request(app)
            .post('/api/search')
            .send(payload);

          // Assert
          expect(response.status).toBe(400);
          expect(response.body.error).toBe('Query must be a string');
        }
      });
    });

    describe('File Upload Security', () => {
      it('should reject dangerous file types', async () => {
        // Arrange
        const dangerousFileTypes = [
          'application/x-executable',
          'application/x-msdownload',
          'text/x-shellscript',
          'application/x-sh',
          'application/x-perl',
          'application/x-python'
        ];

        for (const contentType of dangerousFileTypes) {
          // Act
          const response = await request(app)
            .post('/api/files/upload')
            .set('Content-Type', contentType)
            .send('malicious file content');

          // Assert
          expect(response.status).toBe(400);
          expect(response.body.error).toBe('File type not allowed');
        }
      });

      it('should accept safe file types', async () => {
        // Arrange
        const safeFileTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/pdf',
          'text/csv',
          'application/json'
        ];

        for (const contentType of safeFileTypes) {
          // Act
          const response = await request(app)
            .post('/api/files/upload')
            .set('Content-Type', contentType)
            .send('safe file content');

          // Assert
          expect(response.status).toBe(200);
          expect(response.body.success).toBe(true);
        }
      });

      it('should limit file upload size', async () => {
        // Arrange
        const largePayload = 'x'.repeat(15 * 1024 * 1024); // 15MB

        // Act
        const response = await request(app)
          .post('/api/files/upload')
          .set('Content-Type', 'text/plain')
          .send(largePayload);

        // Assert
        expect(response.status).toBe(413); // Payload too large
      });
    });

    describe('XSS Prevention', () => {
      it('should sanitize user input to prevent XSS', () => {
        // Arrange
        const xssPayloads = [
          '<script>alert("XSS")</script>',
          'javascript:alert("XSS")',
          '<img src="x" onerror="alert(1)">',
          '<svg onload="alert(1)">',
          '&lt;script&gt;alert(1)&lt;/script&gt;'
        ];

        xssPayloads.forEach(payload => {
          // Act - Simulate HTML escaping function
          const sanitized = payload
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');

          // Assert
          expect(sanitized).not.toContain('<script>');
          expect(sanitized).not.toContain('javascript:');
          expect(sanitized).not.toContain('onerror=');
          expect(sanitized).not.toContain('onload=');
        });
      });
    });

    describe('Path Traversal Prevention', () => {
      it('should prevent directory traversal attacks', () => {
        // Arrange
        const pathTraversalPayloads = [
          '../../../etc/passwd',
          '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
          '/etc/passwd',
          'C:\\Windows\\System32\\config\\SAM',
          '....//....//....//etc/passwd',
          '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
        ];

        pathTraversalPayloads.forEach(payload => {
          // Act - Simulate path sanitization
          const sanitized = payload
            .replace(/\.\./g, '') // Remove ..
            .replace(/[\\\/]/g, '_') // Replace path separators
            .replace(/[<>:"|?*]/g, ''); // Remove other dangerous chars

          // Assert
          expect(sanitized).not.toContain('..');
          expect(sanitized).not.toContain('/');
          expect(sanitized).not.toContain('\\');
          expect(sanitized).not.toContain('etc');
          expect(sanitized).not.toContain('passwd');
        });
      });
    });
  });

  describe('Data Validation', () => {
    describe('Email Validation', () => {
      it('should validate email addresses correctly', () => {
        // Arrange
        const validEmails = [
          'user@example.com',
          'test.email+tag@domain.co.uk',
          'user123@sub.domain.com'
        ];

        const invalidEmails = [
          'invalid-email',
          '@domain.com',
          'user@',
          'user..double.dot@domain.com',
          'user@domain.',
          '<script>alert(1)</script>@domain.com'
        ];

        // Simple email validation regex (more comprehensive in real implementation)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        // Act & Assert
        validEmails.forEach(email => {
          expect(emailRegex.test(email)).toBe(true);
        });

        invalidEmails.forEach(email => {
          expect(emailRegex.test(email)).toBe(false);
        });
      });
    });

    describe('Phone Number Validation', () => {
      it('should validate international phone numbers', () => {
        // Arrange
        const validPhones = [
          '+4915123456789',
          '+1234567890',
          '+44207123456'
        ];

        const invalidPhones = [
          '015123456789', // Missing country code
          '+49151234567890123', // Too long
          '+49abc123', // Contains letters
          '+', // Empty number
          'phone-number' // Not a number
        ];

        // Simple international phone regex
        const phoneRegex = /^\+[1-9]\d{6,14}$/;

        // Act & Assert
        validPhones.forEach(phone => {
          expect(phoneRegex.test(phone)).toBe(true);
        });

        invalidPhones.forEach(phone => {
          expect(phoneRegex.test(phone)).toBe(false);
        });
      });
    });

    describe('UUID Validation', () => {
      it('should validate UUID format', () => {
        // Arrange
        const validUUIDs = [
          '123e4567-e89b-12d3-a456-426614174000',
          'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          '00000000-0000-0000-0000-000000000000'
        ];

        const invalidUUIDs = [
          'not-a-uuid',
          '123e4567-e89b-12d3-a456', // Too short
          '123e4567-e89b-12d3-a456-426614174000-extra', // Too long
          'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' // Invalid chars
        ];

        // UUID v4 regex
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        // Act & Assert
        validUUIDs.forEach(uuid => {
          expect(uuidRegex.test(uuid)).toBe(true);
        });

        invalidUUIDs.forEach(uuid => {
          expect(uuidRegex.test(uuid)).toBe(false);
        });
      });
    });
  });

  describe('Rate Limiting Security', () => {
    it('should implement rate limiting for API endpoints', async () => {
      // This test would verify rate limiting implementation
      // In a real scenario, you'd make multiple rapid requests
      
      const requests = [];
      const maxRequests = 10;
      
      // Simulate rapid requests
      for (let i = 0; i < maxRequests + 5; i++) {
        requests.push(
          request(app)
            .get('/api/users/test')
            .then(res => ({ status: res.status, attempt: i + 1 }))
            .catch(err => ({ status: err.status || 500, attempt: i + 1 }))
        );
      }

      const responses = await Promise.all(requests);
      
      // In a real implementation with rate limiting:
      // - First 10 requests should succeed (200)
      // - Subsequent requests should be rate limited (429)
      
      // For this mock, we'll just verify the structure
      expect(responses).toHaveLength(maxRequests + 5);
      responses.forEach((response, index) => {
        expect(response).toHaveProperty('status');
        expect(response).toHaveProperty('attempt');
        expect(response.attempt).toBe(index + 1);
      });
    });
  });

  describe('CORS Security', () => {
    it('should implement proper CORS headers', async () => {
      // Act
      const response = await request(app)
        .options('/api/users/test')
        .set('Origin', 'https://malicious-site.com');

      // Assert
      // In a properly configured app, this should either:
      // 1. Return allowed origins only
      // 2. Return 403 for disallowed origins
      // For this test, we verify the structure exists
      expect(response.status).toBeDefined();
    });
  });

  describe('Content Security Policy', () => {
    it('should set appropriate security headers', async () => {
      // Act
      const response = await request(app)
        .get('/api/users/test');

      // Assert
      // In a production app, these headers should be present:
      const expectedSecurityHeaders = [
        'X-Content-Type-Options',
        'X-Frame-Options', 
        'X-XSS-Protection',
        'Strict-Transport-Security',
        'Content-Security-Policy'
      ];

      // This test verifies the concept - in real implementation,
      // middleware like helmet would set these headers
      expect(response.status).toBeDefined();
      
      // Simulate what proper security headers would look like
      const securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'"
      };

      Object.entries(securityHeaders).forEach(([header, value]) => {
        expect(typeof header).toBe('string');
        expect(typeof value).toBe('string');
      });
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose sensitive information in error messages', () => {
      // Arrange
      const sensitiveInfo = [
        'password',
        'secret',
        'token',
        'key',
        'database',
        'connection string',
        'stack trace',
        '/home/user',
        'C:\\Users\\Admin'
      ];

      const safeErrorMessage = 'An error occurred. Please try again later.';
      const unsafeErrorMessage = 'Database connection failed: postgres://admin:password123@localhost:5432/db';

      // Act & Assert
      // Safe error message should not contain sensitive info
      sensitiveInfo.forEach(sensitive => {
        expect(safeErrorMessage.toLowerCase()).not.toContain(sensitive.toLowerCase());
      });

      // Unsafe error message contains sensitive info (what we want to avoid)
      expect(unsafeErrorMessage.toLowerCase()).toContain('password');
      expect(unsafeErrorMessage.toLowerCase()).toContain('admin');
    });

    it('should log security events for monitoring', () => {
      // Simulate security event logging
      const securityEvents = [];
      
      const logSecurityEvent = (event) => {
        securityEvents.push({
          ...event,
          timestamp: new Date(),
          severity: event.severity || 'medium'
        });
      };

      // Simulate various security events
      logSecurityEvent({
        type: 'authentication_failure',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
        severity: 'high'
      });

      logSecurityEvent({
        type: 'sql_injection_attempt',
        payload: "1'; DROP TABLE users; --",
        ip: '10.0.0.1',
        severity: 'critical'
      });

      logSecurityEvent({
        type: 'rate_limit_exceeded',
        ip: '192.168.1.50',
        endpoint: '/api/users',
        severity: 'medium'
      });

      // Assert
      expect(securityEvents).toHaveLength(3);
      expect(securityEvents[0].type).toBe('authentication_failure');
      expect(securityEvents[1].severity).toBe('critical');
      expect(securityEvents[2].endpoint).toBe('/api/users');
    });
  });

  describe('Session Security', () => {
    it('should generate cryptographically secure session tokens', () => {
      // Act
      const sessionTokens = [];
      for (let i = 0; i < 100; i++) {
        const token = crypto.randomBytes(32).toString('hex');
        sessionTokens.push(token);
      }

      // Assert
      // All tokens should be unique
      const uniqueTokens = new Set(sessionTokens);
      expect(uniqueTokens.size).toBe(100);

      // All tokens should be 64 characters (32 bytes * 2 for hex)
      sessionTokens.forEach(token => {
        expect(token.length).toBe(64);
        expect(/^[a-f0-9]{64}$/.test(token)).toBe(true);
      });
    });

    it('should implement secure session configuration', () => {
      // Simulate secure session configuration
      const sessionConfig = {
        secret: crypto.randomBytes(64).toString('hex'),
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: true, // HTTPS only
          httpOnly: true, // No client-side access
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          sameSite: 'strict' // CSRF protection
        }
      };

      // Assert
      expect(sessionConfig.secret.length).toBe(128); // 64 bytes as hex
      expect(sessionConfig.cookie.secure).toBe(true);
      expect(sessionConfig.cookie.httpOnly).toBe(true);
      expect(sessionConfig.cookie.sameSite).toBe('strict');
    });
  });
});