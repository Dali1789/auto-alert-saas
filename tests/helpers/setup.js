/**
 * Test Setup for London School TDD
 * Configures global mocks, utilities, and test environment
 */

// Configure environment variables for testing
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test-supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.RETELL_API_KEY = 'test-retell-api-key';
process.env.RESEND_API_KEY = 'test-resend-api-key';
process.env.WEBHOOK_SECRET = 'test-webhook-secret';
process.env.CDN_BASE_URL = 'https://test-cdn.com';

// Global test utilities
global.createMockResponse = () => ({
  status: jest.fn(() => mockRes),
  json: jest.fn(() => mockRes),
  send: jest.fn(() => mockRes),
  end: jest.fn(() => mockRes),
  header: jest.fn(() => mockRes),
  setHeader: jest.fn(() => mockRes)
});

global.createMockRequest = (options = {}) => ({
  body: options.body || {},
  params: options.params || {},
  query: options.query || {},
  headers: options.headers || {},
  ip: options.ip || '127.0.0.1',
  user: options.user || null,
  ...options
});

// Mock console methods to reduce test noise
const originalConsole = { ...console };
global.mockConsole = () => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
};

global.restoreConsole = () => {
  Object.assign(console, originalConsole);
};

// London School Test Utilities
global.createCollaboratorMock = (name, methods = []) => {
  const mock = {};
  methods.forEach(method => {
    mock[method] = jest.fn();
  });
  mock._mockName = name;
  return mock;
};

global.verifyMockInteraction = (mock, method, expectedArgs) => {
  expect(mock[method]).toHaveBeenCalledWith(...expectedArgs);
};

global.verifyMockCallOrder = (...calls) => {
  const allCalls = calls.flatMap(mock => 
    Object.keys(mock).filter(key => typeof mock[key].mock !== 'undefined')
      .map(method => ({ mock: mock[method], method }))
  );
  
  // Implementation would check call order across mocks
  // This is a simplified version
  allCalls.forEach(({ mock }) => {
    expect(mock).toHaveBeenCalled();
  });
};

// Contract Verification Utilities
global.verifyContract = (mock, contract) => {
  Object.keys(contract).forEach(method => {
    expect(typeof mock[method]).toBe('function');
  });
};

// Async Test Utilities
global.waitForMockCall = async (mock, method, timeout = 1000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Mock ${method} was not called within ${timeout}ms`));
    }, timeout);

    const checkCall = () => {
      if (mock[method].mock.calls.length > 0) {
        clearTimeout(timer);
        resolve(mock[method].mock.calls[0]);
      } else {
        setTimeout(checkCall, 10);
      }
    };
    checkCall();
  });
};

// Test Data Builders
global.buildVehicleData = (overrides = {}) => ({
  mobileAdId: '12345',
  title: 'BMW 740d xDrive',
  make: 'BMW',
  model: '7er',
  modelDescription: '740d xDrive',
  price: 22500,
  year: 2018,
  mileage: 89000,
  fuel: 'Diesel',
  gearbox: 'Automatik',
  power: 235,
  detailUrl: 'https://suchen.mobile.de/test',
  sellerType: 'Händler',
  sellerCity: 'München',
  sellerZipcode: '80331',
  location: 'München, 80331',
  ...overrides
});

global.buildUserData = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  retell_phone_number: '+4915123456789',
  notification_preferences: {
    email: true,
    voice: true,
    sms: false
  },
  ...overrides
});

global.buildSearchData = (overrides = {}) => ({
  id: 'test-search-id',
  name: 'BMW 7er Search',
  make: 'BMW',
  model: '7er',
  price_max: 30000,
  notification_methods: ['email', 'voice'],
  ...overrides
});

// Error Simulation Utilities
global.createRejectedPromise = (error) => Promise.reject(new Error(error));

global.createAsyncMockError = (mock, method, error) => {
  mock[method].mockRejectedValue(new Error(error));
  return mock;
};

// Database Transaction Mock
global.createTransactionMock = () => ({
  query: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn()
});

// Test Timing Utilities
global.advanceTimers = (ms) => {
  jest.advanceTimersByTime(ms);
};

global.runAllTimers = () => {
  jest.runAllTimers();
};

// Cleanup utilities
global.cleanupMocks = () => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  jest.restoreAllMocks();
};

// Before/After test hooks
beforeEach(() => {
  // Reset environment for each test
  jest.clearAllMocks();
  mockConsole();
});

afterEach(() => {
  restoreConsole();
  cleanupMocks();
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});