module.exports = {
  // Test Environment
  testEnvironment: 'node',
  
  // Test File Patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js'
  ],
  
  // Ignore Patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/'
  ],
  
  // Setup Files
  setupFilesAfterEnv: [
    '<rootDir>/tests/helpers/setup.js'
  ],
  
  // Coverage Configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'railway/notification-service/src/**/*.js',
    'storage/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/dist/**'
  ],
  
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  
  // Coverage Thresholds (London School focuses on behavior over coverage)
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Module Mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/mocks/$1',
    '^@fixtures/(.*)$': '<rootDir>/tests/fixtures/$1'
  },
  
  // Mock Configuration
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Timeout for async tests
  testTimeout: 30000,
  
  // Error Handling
  errorOnDeprecated: true,
  verbose: true,
  
  // Globals for Test Environment
  globals: {
    'process.env.NODE_ENV': 'test'
  },
  
  // Transform Configuration
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Test Results Processor
  reporters: [
    'default'
  ]
};