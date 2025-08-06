# Auto Alert SaaS - Test-Driven Development Framework

## London School (Mockist) TDD Implementation

This project implements a comprehensive Test-Driven Development framework following the **London School** approach, emphasizing interaction-based testing with mocks and behavior verification.

## 🏗️ Framework Architecture

### Directory Structure
```
tests/
├── helpers/           # Test utilities and setup
├── mocks/            # Mock implementations
├── fixtures/         # Test data builders
├── unit/             # Unit tests (isolated components)
├── integration/      # Integration tests (component interactions)
├── e2e/             # End-to-end tests
├── security/        # Security and vulnerability tests
└── performance/     # Load and performance tests
```

## 🎯 London School Principles

### 1. Outside-In Development
- Start with acceptance tests defining user behavior
- Work inward to implementation details
- Drive design through test requirements

### 2. Mock-Driven Development
- Mock all external dependencies
- Focus on object collaborations
- Define clear contracts between components

### 3. Behavior Verification
- Test **how** objects interact, not just **what** they return
- Verify method calls, parameters, and call sequences
- Emphasize communication patterns over state

## 🛠️ Test Categories

### Unit Tests (`tests/unit/`)
**Philosophy**: Test components in complete isolation using mocks for all dependencies.

```javascript
// Example: NotificationService unit test
describe('NotificationService', () => {
  let mockSupabase, mockAxios, mockResend;

  beforeEach(() => {
    mockSupabase = createSupabaseMock();
    mockAxios = createAxiosMock();
    mockResend = createResendMock();
  });

  it('should orchestrate voice call with proper interactions', async () => {
    // Test focuses on HOW components collaborate
    await notificationService.sendVoiceCall(params);
    
    // Verify interactions
    expect(mockAxios.wasRequestMade('POST', 'create-phone-call')).toBe(true);
    expect(mockSupabase.wasOperationPerformed('insert')).toBe(true);
  });
});
```

### Integration Tests (`tests/integration/`)
**Philosophy**: Test component interactions with minimal mocking, focusing on integration contracts.

```javascript
// Example: Webhook integration test
describe('Webhooks Integration', () => {
  it('should process vehicle data end-to-end', async () => {
    const response = await request(app)
      .post('/api/webhooks/n8n')
      .send(webhookPayload);
    
    // Verify complete workflow execution
    expect(response.status).toBe(200);
    expect(mockNotificationService.sendMultiChannel).toHaveBeenCalled();
  });
});
```

### Security Tests (`tests/security/`)
**Philosophy**: Verify security contracts and protection mechanisms.

```javascript
// Example: Input validation security test
describe('Input Validation Security', () => {
  it('should prevent SQL injection attempts', async () => {
    const maliciousInputs = ["1'; DROP TABLE users; --"];
    
    for (const input of maliciousInputs) {
      const response = await request(app).get(`/api/users/${input}`);
      expect(response.status).toBe(400);
    }
  });
});
```

### Performance Tests (`tests/performance/`)
**Philosophy**: Verify performance contracts and scalability behavior.

```javascript
// Example: Load test with performance contracts
describe('Performance Contracts', () => {
  it('should handle batch processing within time limits', async () => {
    const startTime = performance.now();
    const response = await request(app).post('/api/webhooks/n8n').send(largeBatch);
    const endTime = performance.now();
    
    expect(response.status).toBe(200);
    expect(endTime - startTime).toBeLessThan(500); // Performance contract
  });
});
```

## 🔧 Mock Architecture

### Collaborative Mock Design

```javascript
// Supabase Mock - Tracks interactions for verification
class SupabaseMock {
  constructor() {
    this.interactions = [];
  }

  recordInteraction(operation, table, data) {
    this.interactions.push({ operation, table, data, timestamp: new Date() });
  }

  wasOperationPerformed(operation, table) {
    return this.interactions.some(i => i.operation === operation && i.table === table);
  }
}

// Usage in tests
expect(mockSupabase.wasOperationPerformed('insert', 'notifications')).toBe(true);
```

### External Service Mocks

```javascript
// Axios Mock - Simulates HTTP interactions
class AxiosMock {
  constructor() {
    this.requests = [];
    this.mockResponses = new Map();
  }

  setupMockResponse(url, method, response) {
    this.mockResponses.set(`${method}:${url}`, response);
  }

  wasRequestMade(method, url) {
    return this.requests.some(req => req.method === method && req.url.includes(url));
  }
}
```

## 📊 Test Data Management

### Test Data Builders (Object Mother Pattern)

```javascript
// TestDataBuilder - Creates consistent test data
class TestDataBuilder {
  static vehicle(overrides = {}) {
    return {
      mobileAdId: '12345',
      title: 'BMW 740d xDrive',
      price: 22500,
      year: 2018,
      // ... more properties
      ...overrides
    };
  }

  static user(overrides = {}) {
    return {
      id: 'user_123',
      email: 'test@example.com',
      notification_preferences: {
        email: true,
        voice: true
      },
      ...overrides
    };
  }
}
```

### Scenario Builders

```javascript
// ScenarioBuilder - Creates complex test scenarios
class ScenarioBuilder {
  static newVehicleFound() {
    return {
      user: TestDataBuilder.user(),
      search: TestDataBuilder.search(),
      vehicle: TestDataBuilder.vehicle(),
      expectedNotifications: ['email', 'voice']
    };
  }

  static highPriorityAlert() {
    return {
      user: TestDataBuilder.user({ notification_preferences: { voice: true } }),
      vehicle: TestDataBuilder.vehicle({ price: 18000 }),
      expectedUrgency: 'high'
    };
  }
}
```

## 🎮 Running Tests

### Basic Commands
```bash
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only  
npm run test:security      # Security tests only
npm run test:performance   # Performance tests only
npm run test:coverage      # With coverage report
npm run test:watch         # Watch mode
```

### CI/CD Integration
```bash
npm run test:ci            # Optimized for CI environment
```

### Coverage Thresholds
```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 75,
    functions: 80, 
    lines: 80,
    statements: 80
  }
}
```

## 📋 Test Patterns

### 1. Arrange-Act-Assert Pattern
```javascript
it('should process notification correctly', async () => {
  // Arrange - Setup test data and mocks
  const vehicleData = TestDataBuilder.vehicle();
  mockService.setupResponse('success');

  // Act - Execute the behavior
  const result = await service.processNotification(vehicleData);

  // Assert - Verify interactions and outcomes
  expect(mockService.wasCalledWith(vehicleData)).toBe(true);
  expect(result.success).toBe(true);
});
```

### 2. Contract Testing
```javascript
describe('Service Contracts', () => {
  it('should maintain expected interface', () => {
    const expectedMethods = ['sendEmail', 'sendVoiceCall', 'logNotification'];
    
    expectedMethods.forEach(method => {
      expect(typeof notificationService[method]).toBe('function');
    });
  });
});
```

### 3. Interaction Verification
```javascript
it('should coordinate services in correct order', async () => {
  await orchestrator.execute(task);
  
  // Verify specific interaction sequence
  expect(mockServiceA.prepare).toHaveBeenCalledBefore(mockServiceB.process);
  expect(mockServiceB.process).toHaveBeenCalledBefore(mockServiceC.finalize);
});
```

## 🔍 Best Practices

### Mock Management
- **Keep mocks simple** - Focus on essential interactions
- **Verify behavior, not implementation** - Test what matters to clients
- **Use descriptive mock methods** - `wasCalledWith()`, `wasOperationPerformed()`
- **Reset mocks between tests** - Ensure test isolation

### Test Organization
- **One assertion per concept** - Clear test intent
- **Descriptive test names** - Explain behavior being tested
- **Group related tests** - Logical test organization
- **Fast feedback loops** - Quick test execution

### Collaboration Testing
```javascript
it('should handle multi-channel notification workflow', async () => {
  // Setup collaborators
  mockSupabase.setMockData('users', [testUser]);
  mockEmailService.setupSuccess();
  mockVoiceService.setupSuccess();

  // Execute workflow
  const results = await service.sendMultiChannel(params);

  // Verify all collaborations occurred
  expect(mockSupabase.wasTableAccessed('users')).toBe(true);
  expect(mockEmailService.wasCalled()).toBe(true);
  expect(mockVoiceService.wasCalled()).toBe(true);
  
  // Verify workflow results
  expect(results.every(r => r.success)).toBe(true);
});
```

## 📈 Continuous Integration

### GitHub Actions Integration
```yaml
# .github/workflows/test.yml
name: TDD Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:ci
      - uses: codecov/codecov-action@v3
```

### Coverage Reports
- **HTML Report**: `coverage/lcov-report/index.html`
- **JSON Summary**: `coverage/coverage-summary.json`
- **JUnit XML**: `coverage/junit.xml`

## 🛡️ Security Testing

### Input Validation Tests
```javascript
describe('Security Validation', () => {
  const maliciousInputs = [
    "'; DROP TABLE users; --",
    '<script>alert("xss")</script>',
    '../../../etc/passwd'
  ];

  maliciousInputs.forEach(input => {
    it(`should reject malicious input: ${input}`, async () => {
      const response = await request(app).post('/api/endpoint').send({ data: input });
      expect([400, 422]).toContain(response.status);
    });
  });
});
```

## 🚀 Performance Testing

### Load Testing Patterns
```javascript
describe('Load Testing', () => {
  it('should maintain performance under concurrent load', async () => {
    const concurrentRequests = Array.from({ length: 10 }, () => 
      request(app).post('/api/webhooks/n8n').send(payload)
    );

    const startTime = performance.now();
    const responses = await Promise.all(concurrentRequests);
    const endTime = performance.now();

    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
    
    expect(endTime - startTime).toBeLessThan(1000); // Performance contract
  });
});
```

## 📚 Resources

### London School TDD References
- [Growing Object-Oriented Software, Guided by Tests](https://www.growing-object-oriented-software.com/)
- [Mock Roles, not Objects](https://jmock.org/oopsla2004.pdf)
- [The Magic Tricks of Testing by Sandi Metz](https://www.youtube.com/watch?v=URSWYvyc42M)

### Testing Tools
- **Jest**: Test runner and assertion library
- **Supertest**: HTTP integration testing
- **Jest-junit**: CI/CD reporting
- **Sharp**: Image processing mocks

## 🎯 Key Benefits

### Fast Feedback
- **Isolated tests** run quickly without external dependencies
- **Parallel execution** leverages modern hardware
- **Focused failures** pinpoint exact issues

### Design Quality
- **Outside-in development** ensures user-focused design
- **Mock contracts** define clear interfaces
- **Interaction testing** reveals coupling issues

### Maintainability
- **Behavior-focused tests** survive refactoring
- **Clear test structure** aids understanding
- **Comprehensive mocks** simplify debugging

This TDD framework provides a solid foundation for developing robust, well-tested software using London School principles with modern JavaScript tooling.