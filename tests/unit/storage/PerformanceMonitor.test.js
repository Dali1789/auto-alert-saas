/**
 * PerformanceMonitor Unit Tests - London School TDD
 * Focus on monitoring interactions, alerting behavior, and metrics collection contracts
 */

const PerformanceMonitor = require('../../../storage/monitoring/performance-monitor');
const { createRedisMock } = require('../../mocks/external-apis.mock');
const { TestDataBuilder } = require('../../fixtures/test-data');

describe('PerformanceMonitor', () => {
  let performanceMonitor;
  let mockDatabase;
  let mockRedis;

  beforeEach(() => {
    // Create mock database
    mockDatabase = {
      query: jest.fn()
    };

    // Create mock Redis
    mockRedis = {
      client: createRedisMock()
    };

    // Initialize performance monitor
    performanceMonitor = new PerformanceMonitor({
      enabled: true,
      slowQueryThreshold: 1000,
      alertThresholds: {
        cpu: 80,
        memory: 85,
        queryTime: 2000,
        cacheHitRate: 70
      },
      flushInterval: 1000, // Short interval for testing
      samplingRate: 1.0
    });

    // Mock timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    performanceMonitor.stopCollection();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    describe('initialize', () => {
      it('should setup monitoring for all configured systems', async () => {
        // Act
        await performanceMonitor.initialize(mockDatabase, mockRedis);

        // Assert
        expect(performanceMonitor.db).toBe(mockDatabase);
        expect(performanceMonitor.redis).toBe(mockRedis);
        expect(performanceMonitor.isCollecting).toBe(true);
      });

      it('should wrap database query method for monitoring', async () => {
        // Arrange
        const originalQuery = mockDatabase.query;
        mockDatabase.query.mockResolvedValue({
          rows: [{ id: 1, name: 'test' }],
          rowCount: 1
        });

        // Act
        await performanceMonitor.initialize(mockDatabase, mockRedis);
        await mockDatabase.query('SELECT * FROM test_table');

        // Assert
        expect(mockDatabase.query).not.toBe(originalQuery); // Should be wrapped
        expect(performanceMonitor.queryHistory).toHaveLength(1);
        expect(performanceMonitor.queryHistory[0]).toMatchObject({
          normalizedQuery: expect.stringContaining('SELECT'),
          queryType: 'SELECT',
          executionTimeMs: expect.any(Number),
          rowsReturned: 1
        });
      });

      it('should setup Redis command monitoring', async () => {
        // Act
        await performanceMonitor.initialize(mockDatabase, mockRedis);
        
        // Execute Redis command
        await mockRedis.client.get('test-key');

        // Assert
        expect(performanceMonitor.metricsBuffer.some(
          m => m.type === 'redis_performance' && m.data.command === 'get'
        )).toBe(true);
      });
    });

    describe('setupDatabaseMonitoring', () => {
      it('should track query execution timing accurately', async () => {
        // Arrange
        const startTime = Date.now();
        mockDatabase.query.mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve({ rows: [], rowCount: 0 }), 100);
          });
        });

        await performanceMonitor.initialize(mockDatabase, mockRedis);

        // Act
        await mockDatabase.query('SELECT slow_operation()');

        // Advance timers to simulate query execution
        jest.advanceTimersByTime(100);
        await Promise.resolve(); // Allow promise to resolve

        // Assert
        expect(performanceMonitor.queryHistory).toHaveLength(1);
        expect(performanceMonitor.queryHistory[0].executionTimeMs).toBeGreaterThan(0);
      });

      it('should handle both callback and promise-style queries', async () => {
        // Arrange
        await performanceMonitor.initialize(mockDatabase, mockRedis);

        // Test callback style
        const callbackResult = { rows: [{ id: 1 }] };
        const mockCallback = jest.fn();

        mockDatabase.query('SELECT * FROM table1', [], mockCallback);
        
        // Simulate callback execution
        const wrappedCallback = mockCallback.mock.calls[0] || mockDatabase.query.mock.calls[0][2];
        if (wrappedCallback) {
          wrappedCallback(null, callbackResult);
        }

        // Test promise style
        mockDatabase.query.mockResolvedValue({ rows: [{ id: 2 }] });
        await mockDatabase.query('SELECT * FROM table2');

        // Assert
        expect(performanceMonitor.queryHistory.length).toBeGreaterThan(0);
      });

      it('should record query errors properly', async () => {
        // Arrange
        const testError = new Error('Database connection lost');
        mockDatabase.query.mockRejectedValue(testError);
        await performanceMonitor.initialize(mockDatabase, mockRedis);

        // Act
        try {
          await mockDatabase.query('SELECT * FROM nonexistent');
        } catch (error) {
          // Expected to throw
        }

        // Assert
        const errorQuery = performanceMonitor.queryHistory.find(q => q.hasError);
        expect(errorQuery).toBeDefined();
        expect(errorQuery.errorMessage).toBe('Database connection lost');
      });
    });
  });

  describe('Query Performance Analysis', () => {
    describe('recordQueryMetrics', () => {
      it('should classify slow queries correctly', () => {
        // Arrange
        const queryData = {
          queryId: 'query_123',
          text: 'SELECT * FROM large_table WHERE complex_condition',
          executionTime: 2500, // Above threshold
          result: { rowCount: 1000 },
          startTime: new Date()
        };

        // Act
        performanceMonitor.recordQueryMetrics(queryData);

        // Assert
        const recordedQuery = performanceMonitor.queryHistory[0];
        expect(recordedQuery.isSlowQuery).toBe(true);
        expect(recordedQuery.executionTimeMs).toBe(2500);
        expect(recordedQuery.rowsReturned).toBe(1000);
      });

      it('should identify optimization candidates', () => {
        // Arrange
        const inefficientQueries = [
          'SELECT * FROM users WHERE name LIKE \'%john%\'',
          'SELECT DISTINCT email FROM large_table',
          'SELECT id FROM table WHERE id NOT IN (SELECT user_id FROM other)',
          'SELECT name FROM users ORDER BY RANDOM()'
        ];

        inefficientQueries.forEach((queryText, index) => {
          const queryData = {
            queryId: `query_${index}`,
            text: queryText,
            executionTime: 600, // Above optimization threshold
            result: { rowCount: 10 },
            startTime: new Date()
          };

          // Act
          performanceMonitor.recordQueryMetrics(queryData);

          // Assert
          const recordedQuery = performanceMonitor.queryHistory[index];
          expect(recordedQuery.isOptimizationCandidate).toBe(true);
        });
      });

      it('should normalize queries for pattern analysis', () => {
        // Arrange
        const queries = [
          'SELECT * FROM users WHERE id = $1',
          'SELECT * FROM users WHERE id = $2',
          'SELECT * FROM users WHERE id = $3'
        ];

        queries.forEach((queryText, index) => {
          const queryData = {
            queryId: `query_${index}`,
            text: queryText,
            executionTime: 50,
            result: { rowCount: 1 },
            startTime: new Date()
          };

          // Act
          performanceMonitor.recordQueryMetrics(queryData);
        });

        // Assert
        const normalizedQueries = performanceMonitor.queryHistory.map(q => q.normalizedQuery);
        const uniqueNormalized = [...new Set(normalizedQueries)];
        expect(uniqueNormalized).toHaveLength(1);
        expect(uniqueNormalized[0]).toBe('SELECT * FROM users WHERE id = ?');
      });

      it('should emit events for real-time monitoring', () => {
        // Arrange
        const eventSpy = jest.fn();
        performanceMonitor.on('queryExecuted', eventSpy);

        const queryData = {
          queryId: 'query_123',
          text: 'SELECT * FROM test',
          executionTime: 100,
          result: { rowCount: 5 },
          startTime: new Date()
        };

        // Act
        performanceMonitor.recordQueryMetrics(queryData);

        // Assert
        expect(eventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            queryType: 'SELECT',
            executionTimeMs: 100,
            rowsReturned: 5
          })
        );
      });
    });

    describe('getQueryType', () => {
      it('should correctly identify query types', () => {
        // Arrange & Act & Assert
        const testCases = [
          { query: 'SELECT * FROM users', expected: 'SELECT' },
          { query: '  select id from table', expected: 'SELECT' },
          { query: 'INSERT INTO users VALUES (1)', expected: 'INSERT' },
          { query: 'UPDATE users SET name = ?', expected: 'UPDATE' },
          { query: 'DELETE FROM old_records', expected: 'DELETE' },
          { query: 'CREATE TABLE new_table', expected: 'CREATE' },
          { query: 'ALTER TABLE users ADD COLUMN', expected: 'ALTER' },
          { query: 'DROP TABLE temp_table', expected: 'DROP' },
          { query: 'EXPLAIN SELECT * FROM users', expected: 'OTHER' }
        ];

        testCases.forEach(({ query, expected }) => {
          expect(performanceMonitor.getQueryType(query)).toBe(expected);
        });
      });
    });
  });

  describe('System Metrics Collection', () => {
    describe('collectSystemMetrics', () => {
      it('should gather comprehensive system metrics', async () => {
        // Arrange
        performanceMonitor.getCPUUsage = jest.fn().mockResolvedValue({
          usage: 45.2,
          loadAverage: [1.2, 1.5, 1.3],
          cores: 4
        });

        performanceMonitor.getMemoryUsage = jest.fn().mockResolvedValue({
          systemUsagePercent: 75.0,
          processHeapUsed: 52428800
        });

        performanceMonitor.getDatabaseStats = jest.fn().mockResolvedValue({
          active_connections: 5,
          cacheHitRatio: 95.2
        });

        performanceMonitor.getRedisStats = jest.fn().mockResolvedValue({
          connectedClients: 3,
          hitRate: 87.5
        });

        // Act
        await performanceMonitor.collectSystemMetrics();

        // Assert
        expect(performanceMonitor.systemMetrics).toHaveLength(1);
        const metrics = performanceMonitor.systemMetrics[0];
        
        expect(metrics.cpu.usage).toBe(45.2);
        expect(metrics.memory.systemUsagePercent).toBe(75.0);
        expect(metrics.database.cacheHitRatio).toBe(95.2);
        expect(metrics.redis.hitRate).toBe(87.5);
      });

      it('should retain metrics within configured retention period', async () => {
        // Arrange
        performanceMonitor.config.metricsRetention = 1000; // 1 second

        // Add old metrics
        const oldMetric = {
          timestamp: new Date(Date.now() - 2000), // 2 seconds ago
          cpu: { usage: 50 }
        };
        performanceMonitor.systemMetrics.push(oldMetric);

        // Mock current metrics gathering
        performanceMonitor.getCPUUsage = jest.fn().mockResolvedValue({ usage: 60 });
        performanceMonitor.getMemoryUsage = jest.fn().mockResolvedValue({ systemUsagePercent: 70 });
        performanceMonitor.getDatabaseStats = jest.fn().mockResolvedValue({});
        performanceMonitor.getRedisStats = jest.fn().mockResolvedValue({});
        performanceMonitor.getNetworkStats = jest.fn().mockResolvedValue({});
        performanceMonitor.getApplicationStats = jest.fn().mockResolvedValue({});

        // Act
        await performanceMonitor.collectSystemMetrics();

        // Assert
        expect(performanceMonitor.systemMetrics).toHaveLength(1); // Old metric removed
        expect(performanceMonitor.systemMetrics[0].cpu.usage).toBe(60);
      });
    });

    describe('getDatabaseStats', () => {
      it('should calculate cache hit ratio correctly', async () => {
        // Arrange
        mockDatabase.query.mockResolvedValue({
          rows: [{
            numbackends: 5,
            blocks_read: 1000,
            blocks_hit: 9000, // 90% cache hit ratio
            tuples_returned: 50000
          }]
        });

        await performanceMonitor.initialize(mockDatabase, mockRedis);

        // Act
        const stats = await performanceMonitor.getDatabaseStats();

        // Assert
        expect(stats.active_connections).toBe(5);
        expect(stats.cacheHitRatio).toBe(90); // 9000 / (1000 + 9000) * 100
        expect(stats.tuples_returned).toBe(50000);
      });

      it('should handle database query errors gracefully', async () => {
        // Arrange
        mockDatabase.query.mockRejectedValue(new Error('Permission denied'));
        await performanceMonitor.initialize(mockDatabase, mockRedis);

        // Act
        const stats = await performanceMonitor.getDatabaseStats();

        // Assert
        expect(stats).toBeNull();
      });
    });

    describe('getRedisStats', () => {
      it('should parse Redis INFO command output correctly', async () => {
        // Arrange
        const mockRedisInfo = `# Memory
used_memory:1048576
# Stats
total_commands_processed:100
instantaneous_ops_per_sec:10
keyspace_hits:75
keyspace_misses:25
# Clients
connected_clients:5`;

        mockRedis.client.info.mockResolvedValue(mockRedisInfo);

        // Act
        const stats = await performanceMonitor.getRedisStats();

        // Assert
        expect(stats.connectedClients).toBe(5);
        expect(stats.usedMemory).toBe(1048576);
        expect(stats.totalCommandsProcessed).toBe(100);
        expect(stats.hitRate).toBe(75); // 75 / (75 + 25) * 100
      });

      it('should calculate hit rate correctly', () => {
        // Arrange
        const testCases = [
          { hits: '100', misses: '25', expected: 80 }, // 100/(100+25) * 100
          { hits: '0', misses: '10', expected: 0 },
          { hits: '50', misses: '0', expected: 100 },
          { hits: '0', misses: '0', expected: 0 }
        ];

        testCases.forEach(({ hits, misses, expected }) => {
          const stats = { keyspace_hits: hits, keyspace_misses: misses };
          const hitRate = performanceMonitor.calculateRedisHitRate(stats);
          expect(hitRate).toBe(expected);
        });
      });
    });
  });

  describe('Alerting System', () => {
    describe('checkAlertThresholds', () => {
      it('should generate alerts when thresholds are exceeded', () => {
        // Arrange
        const alertSpy = jest.fn();
        performanceMonitor.on('alert', alertSpy);

        const metrics = TestDataBuilder.performanceMetrics({
          cpu: { usage: 95.5 }, // Above 80% threshold
          memory: { systemUsagePercent: 90.2 }, // Above 85% threshold
          database: { cacheHitRatio: 65.0 } // Below 70% threshold
        });

        // Act
        performanceMonitor.checkAlertThresholds(metrics);

        // Assert
        expect(performanceMonitor.alerts).toHaveLength(3);
        expect(alertSpy).toHaveBeenCalledTimes(3);

        const alertTypes = performanceMonitor.alerts.map(a => a.type);
        expect(alertTypes).toContain('cpu_high');
        expect(alertTypes).toContain('memory_high');
        expect(alertTypes).toContain('low_cache_hit_rate');
      });

      it('should not generate alerts when thresholds are within limits', () => {
        // Arrange
        const alertSpy = jest.fn();
        performanceMonitor.on('alert', alertSpy);

        const metrics = TestDataBuilder.performanceMetrics({
          cpu: { usage: 60.0 }, // Below threshold
          memory: { systemUsagePercent: 70.0 }, // Below threshold
          database: { cacheHitRatio: 95.0 } // Above threshold
        });

        // Act
        performanceMonitor.checkAlertThresholds(metrics);

        // Assert
        expect(performanceMonitor.alerts).toHaveLength(0);
        expect(alertSpy).not.toHaveBeenCalled();
      });

      it('should clean up old alerts automatically', () => {
        // Arrange
        const oldAlert = {
          type: 'cpu_high',
          timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
        };
        performanceMonitor.alerts.push(oldAlert);

        const metrics = TestDataBuilder.performanceMetrics({
          cpu: { usage: 85.0 } // Trigger new alert
        });

        // Act
        performanceMonitor.checkAlertThresholds(metrics);

        // Assert
        expect(performanceMonitor.alerts).toHaveLength(1); // Old alert removed
        expect(performanceMonitor.alerts[0].type).toBe('cpu_high');
        expect(performanceMonitor.alerts[0].timestamp.getTime()).toBeGreaterThan(oldAlert.timestamp.getTime());
      });
    });

    describe('checkQueryPerformance', () => {
      it('should generate slow query alerts', () => {
        // Arrange
        const alertSpy = jest.fn();
        performanceMonitor.on('alert', alertSpy);

        const queryMetrics = {
          queryHash: 'abc123',
          queryType: 'SELECT',
          executionTimeMs: 2500,
          isSlowQuery: true
        };

        // Act
        performanceMonitor.checkQueryPerformance(queryMetrics);

        // Assert
        expect(performanceMonitor.alerts).toHaveLength(1);
        expect(performanceMonitor.alerts[0].type).toBe('slow_query');
        expect(performanceMonitor.alerts[0].executionTime).toBe(2500);
        expect(alertSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'slow_query',
            queryHash: 'abc123'
          })
        );
      });

      it('should not alert for fast queries', () => {
        // Arrange
        const alertSpy = jest.fn();
        performanceMonitor.on('alert', alertSpy);

        const queryMetrics = {
          executionTimeMs: 50,
          isSlowQuery: false
        };

        // Act
        performanceMonitor.checkQueryPerformance(queryMetrics);

        // Assert
        expect(performanceMonitor.alerts).toHaveLength(0);
        expect(alertSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Metrics Persistence', () => {
    describe('flushMetrics', () => {
      it('should batch and persist metrics to database', async () => {
        // Arrange
        await performanceMonitor.initialize(mockDatabase, mockRedis);

        // Add test metrics to buffer
        performanceMonitor.metricsBuffer.push(
          { type: 'query_performance', data: { queryHash: 'abc123' } },
          { type: 'redis_performance', data: { command: 'get' } },
          { type: 'system_metrics', data: { cpu: 50 } }
        );

        performanceMonitor.persistQueryMetrics = jest.fn().mockResolvedValue();
        performanceMonitor.persistRedisMetrics = jest.fn().mockResolvedValue();
        performanceMonitor.persistSystemMetrics = jest.fn().mockResolvedValue();

        // Act
        await performanceMonitor.flushMetrics();

        // Assert
        expect(performanceMonitor.persistQueryMetrics).toHaveBeenCalledWith([
          { queryHash: 'abc123' }
        ]);
        expect(performanceMonitor.persistRedisMetrics).toHaveBeenCalledWith([
          { command: 'get' }
        ]);
        expect(performanceMonitor.persistSystemMetrics).toHaveBeenCalledWith([
          { cpu: 50 }
        ]);

        // Buffer should be cleared
        expect(performanceMonitor.metricsBuffer).toHaveLength(0);
      });

      it('should handle persistence failures gracefully', async () => {
        // Arrange
        await performanceMonitor.initialize(mockDatabase, mockRedis);
        
        const testMetrics = [
          { type: 'query_performance', data: { queryHash: 'failed' } }
        ];
        performanceMonitor.metricsBuffer.push(...testMetrics);

        performanceMonitor.persistQueryMetrics = jest.fn().mockRejectedValue(
          new Error('Database unavailable')
        );

        // Act
        await performanceMonitor.flushMetrics();

        // Assert
        // Failed metrics should be returned to buffer
        expect(performanceMonitor.metricsBuffer).toHaveLength(1);
        expect(performanceMonitor.metricsBuffer[0].data.queryHash).toBe('failed');
      });
    });

    describe('persistQueryMetrics', () => {
      it('should generate correct SQL for batch insert', async () => {
        // Arrange
        await performanceMonitor.initialize(mockDatabase, mockRedis);
        
        const metrics = [
          {
            queryHash: 'abc123',
            queryType: 'SELECT',
            queryText: 'SELECT * FROM users',
            normalizedQuery: 'SELECT * FROM users',
            executionTimeMs: 150,
            rowsReturned: 10,
            hasError: false,
            errorMessage: null,
            isSlowQuery: false,
            isOptimizationCandidate: false,
            timestamp: new Date()
          }
        ];

        // Act
        await performanceMonitor.persistQueryMetrics(metrics);

        // Assert
        expect(mockDatabase.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO monitoring.query_performance'),
          expect.arrayContaining([
            'abc123',
            'SELECT',
            'SELECT * FROM users',
            'SELECT * FROM users',
            150,
            10,
            false,
            null,
            false,
            false,
            expect.any(Date)
          ])
        );
      });
    });

    describe('persistRedisMetrics', () => {
      it('should store Redis metrics with TTL', async () => {
        // Arrange
        await performanceMonitor.initialize(mockDatabase, mockRedis);
        
        const metrics = [
          {
            command: 'get',
            executionTimeMs: 5,
            hasError: false,
            timestamp: new Date()
          }
        ];

        // Act
        await performanceMonitor.persistRedisMetrics(metrics);

        // Assert
        expect(mockRedis.client.setEx).toHaveBeenCalledWith(
          expect.stringMatching(/^metrics:redis:get:\d+$/),
          3600, // 1 hour TTL
          expect.stringContaining('"command":"get"')
        );
      });
    });
  });

  describe('Performance Analysis', () => {
    describe('getSystemHealthSummary', () => {
      it('should compile comprehensive health status', async () => {
        // Arrange
        performanceMonitor.systemMetrics.push(
          TestDataBuilder.performanceMetrics()
        );
        
        performanceMonitor.queryHistory.push(
          { isSlowQuery: true, executionTimeMs: 2000 },
          { isSlowQuery: false, executionTimeMs: 100 }
        );

        performanceMonitor.alerts.push({
          type: 'cpu_high',
          timestamp: new Date()
        });

        // Act
        const healthSummary = await performanceMonitor.getSystemHealthSummary();

        // Assert
        expect(healthSummary.status).toBe('warning'); // Due to alerts
        expect(healthSummary.summary.totalQueries).toBe(2);
        expect(healthSummary.summary.slowQueries).toBe(1);
        expect(healthSummary.summary.alertsLastHour).toBe(1);
        expect(healthSummary.metrics).toBeDefined();
        expect(healthSummary.alerts).toHaveLength(1);
      });

      it('should return healthy status when no alerts', async () => {
        // Arrange
        performanceMonitor.systemMetrics.push(
          TestDataBuilder.performanceMetrics()
        );

        // Act
        const healthSummary = await performanceMonitor.getSystemHealthSummary();

        // Assert
        expect(healthSummary.status).toBe('healthy');
        expect(healthSummary.summary.alertsLastHour).toBe(0);
      });
    });

    describe('getSlowQueries', () => {
      it('should return aggregated slow query statistics', async () => {
        // Arrange
        mockDatabase.query.mockResolvedValue({
          rows: [
            {
              query_hash: 'abc123',
              query_type: 'SELECT',
              normalized_query: 'SELECT * FROM large_table',
              avg_execution_time: 2500.0,
              execution_count: 15,
              max_execution_time: 4000.0,
              min_execution_time: 1500.0
            }
          ]
        });

        await performanceMonitor.initialize(mockDatabase, mockRedis);

        // Act
        const slowQueries = await performanceMonitor.getSlowQueries(10);

        // Assert
        expect(mockDatabase.query).toHaveBeenCalledWith(
          expect.stringContaining('FROM monitoring.query_performance'),
          [10]
        );
        expect(slowQueries).toHaveLength(1);
        expect(slowQueries[0].avg_execution_time).toBe(2500.0);
      });
    });
  });

  describe('Configuration and Lifecycle', () => {
    it('should start and stop collection properly', () => {
      // Act
      performanceMonitor.startCollection();

      // Assert
      expect(performanceMonitor.isCollecting).toBe(true);

      // Act
      performanceMonitor.stopCollection();

      // Assert
      expect(performanceMonitor.isCollecting).toBe(false);
    });

    it('should cleanup resources on shutdown', async () => {
      // Arrange
      performanceMonitor.flushMetrics = jest.fn().mockResolvedValue();
      performanceMonitor.stopCollection = jest.fn();

      // Act
      await performanceMonitor.shutdown();

      // Assert
      expect(performanceMonitor.stopCollection).toHaveBeenCalled();
      expect(performanceMonitor.flushMetrics).toHaveBeenCalled();
    });

    it('should respect sampling rate configuration', () => {
      // Arrange
      const lowSamplingMonitor = new PerformanceMonitor({
        samplingRate: 0.1 // 10% sampling
      });

      // Act & Assert
      let sampledCount = 0;
      for (let i = 0; i < 100; i++) {
        if (lowSamplingMonitor.shouldSample()) {
          sampledCount++;
        }
      }
      
      // Should sample approximately 10 out of 100 (with some variance)
      expect(sampledCount).toBeLessThan(50); // Much less than 50%
    });

    it('should maintain expected public interface', () => {
      // Arrange
      const expectedMethods = [
        'initialize',
        'startCollection',
        'stopCollection',
        'collectSystemMetrics',
        'recordQueryMetrics',
        'getSystemHealthSummary',
        'getSlowQueries',
        'getPerformanceTrends',
        'flushMetrics',
        'shutdown'
      ];

      // Assert
      expectedMethods.forEach(method => {
        expect(typeof performanceMonitor[method]).toBe('function');
      });
    });
  });
});