/**
 * Performance Load Tests - London School TDD
 * Focus on system behavior under load and performance contracts
 */

const request = require('supertest');
const express = require('express');
const { performance } = require('perf_hooks');
const { TestDataBuilder } = require('../fixtures/test-data');

// Create mock performance test endpoints
function createPerformanceTestApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  
  // Mock database operations with simulated delays
  const simulateDbDelay = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Webhook endpoint with database simulation
  app.post('/api/webhooks/n8n', async (req, res) => {
    const startTime = performance.now();
    
    // Simulate authentication check
    await simulateDbDelay(10);
    
    // Simulate processing each vehicle
    const vehicles = req.body.newVehicles || [];
    for (const vehicle of vehicles) {
      // Simulate database insert
      await simulateDbDelay(25);
      
      // Simulate notification sending
      await simulateDbDelay(100);
    }
    
    const endTime = performance.now();
    
    res.json({
      success: true,
      processed: vehicles.length,
      processingTime: endTime - startTime
    });
  });

  // Search endpoint with pagination
  app.get('/api/searches', async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Simulate database query delay based on result size
    const baseDelay = 20;
    const perItemDelay = 2;
    await simulateDbDelay(baseDelay + (limitNum * perItemDelay));
    
    // Generate mock search results
    const results = Array.from({ length: limitNum }, (_, i) => ({
      id: `search_${pageNum}_${i}`,
      name: `Search ${pageNum}-${i}`,
      created_at: new Date()
    }));
    
    res.json({
      data: results,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: 1000 // Mock total
      }
    });
  });

  // Resource intensive endpoint
  app.get('/api/reports/heavy', async (req, res) => {
    const startTime = performance.now();
    
    // Simulate heavy computation
    const data = [];
    for (let i = 0; i < 1000; i++) {
      data.push({
        id: i,
        computed: Math.random() * 1000,
        timestamp: new Date()
      });
      
      // Simulate some processing time
      if (i % 100 === 0) {
        await simulateDbDelay(5);
      }
    }
    
    const endTime = performance.now();
    
    res.json({
      data,
      meta: {
        processingTime: endTime - startTime,
        recordCount: data.length
      }
    });
  });

  return app;
}

describe('Performance Load Tests', () => {
  let app;

  beforeAll(() => {
    app = createPerformanceTestApp();
  });

  describe('Webhook Endpoint Performance', () => {
    it('should handle single vehicle webhook within acceptable time', async () => {
      // Arrange
      const payload = TestDataBuilder.webhookPayload({
        newVehicles: [TestDataBuilder.vehicle()]
      });

      const startTime = performance.now();

      // Act
      const response = await request(app)
        .post('/api/webhooks/n8n')
        .send(payload);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.processed).toBe(1);
      
      // Performance assertion - should complete within 500ms
      expect(totalTime).toBeLessThan(500);
    });

    it('should handle batch vehicle webhooks efficiently', async () => {
      // Arrange
      const batchSizes = [1, 5, 10, 25, 50];
      const results = [];

      for (const batchSize of batchSizes) {
        const vehicles = Array.from({ length: batchSize }, (_, i) => 
          TestDataBuilder.vehicle({ mobileAdId: `${123456 + i}` })
        );
        
        const payload = TestDataBuilder.webhookPayload({
          newVehicles: vehicles
        });

        const startTime = performance.now();

        // Act
        const response = await request(app)
          .post('/api/webhooks/n8n')
          .send(payload);

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.processed).toBe(batchSize);

        results.push({
          batchSize,
          totalTime,
          timePerVehicle: totalTime / batchSize,
          serverReportedTime: response.body.processingTime
        });
      }

      // Performance analysis
      console.log('Batch Performance Results:', results);

      // Assert scalability characteristics
      results.forEach(result => {
        // Each vehicle should process in reasonable time
        expect(result.timePerVehicle).toBeLessThan(200); // 200ms per vehicle max
        
        // Server-side processing should be efficient
        expect(result.serverReportedTime).toBeLessThan(result.totalTime);
      });

      // Check that processing doesn't degrade significantly with size
      const smallBatch = results.find(r => r.batchSize === 5);
      const largeBatch = results.find(r => r.batchSize === 50);
      
      // Time per vehicle shouldn't increase dramatically
      const degradationRatio = largeBatch.timePerVehicle / smallBatch.timePerVehicle;
      expect(degradationRatio).toBeLessThan(3); // Less than 3x degradation
    });

    it('should handle concurrent webhook requests', async () => {
      // Arrange
      const concurrentRequests = 10;
      const payload = TestDataBuilder.webhookPayload({
        newVehicles: [TestDataBuilder.vehicle()]
      });

      const requests = Array.from({ length: concurrentRequests }, (_, i) => {
        const startTime = performance.now();
        
        return request(app)
          .post('/api/webhooks/n8n')
          .send({
            ...payload,
            searchId: `search_${i}` // Unique per request
          })
          .then(response => ({
            status: response.status,
            success: response.body.success,
            processingTime: performance.now() - startTime,
            requestId: i
          }));
      });

      const startTime = performance.now();

      // Act
      const responses = await Promise.all(requests);

      const endTime = performance.now();
      const totalConcurrentTime = endTime - startTime;

      // Assert
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.success).toBe(true);
        expect(response.requestId).toBe(index);
      });

      // Concurrent processing should be faster than sequential
      const averageResponseTime = responses.reduce(
        (sum, r) => sum + r.processingTime, 0
      ) / responses.length;

      const estimatedSequentialTime = averageResponseTime * concurrentRequests;
      
      console.log({
        concurrentTime: totalConcurrentTime,
        estimatedSequentialTime,
        improvement: estimatedSequentialTime / totalConcurrentTime
      });

      // Should show some concurrency benefit
      expect(totalConcurrentTime).toBeLessThan(estimatedSequentialTime * 0.8);
    });
  });

  describe('Search Endpoint Performance', () => {
    it('should handle paginated requests efficiently', async () => {
      // Arrange
      const pageSizes = [10, 25, 50, 100];
      const results = [];

      for (const pageSize of pageSizes) {
        const startTime = performance.now();

        // Act
        const response = await request(app)
          .get('/api/searches')
          .query({ page: 1, limit: pageSize });

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(pageSize);
        expect(response.body.pagination.limit).toBe(pageSize);

        results.push({
          pageSize,
          totalTime,
          timePerRecord: totalTime / pageSize
        });
      }

      console.log('Pagination Performance:', results);

      // Performance assertions
      results.forEach(result => {
        // Each page should load within reasonable time
        expect(result.totalTime).toBeLessThan(1000); // 1 second max
        
        // Time per record should be reasonable
        expect(result.timePerRecord).toBeLessThan(20); // 20ms per record max
      });
    });

    it('should maintain performance across multiple pages', async () => {
      // Arrange
      const pageSize = 25;
      const pages = [1, 2, 5, 10, 20];
      const results = [];

      for (const page of pages) {
        const startTime = performance.now();

        // Act
        const response = await request(app)
          .get('/api/searches')
          .query({ page, limit: pageSize });

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(pageSize);
        expect(response.body.pagination.page).toBe(page);

        results.push({
          page,
          totalTime
        });
      }

      // Performance should be consistent across pages
      const avgTime = results.reduce((sum, r) => sum + r.totalTime, 0) / results.length;
      const maxDeviation = Math.max(...results.map(r => Math.abs(r.totalTime - avgTime)));
      
      // No page should deviate more than 50% from average
      expect(maxDeviation).toBeLessThan(avgTime * 0.5);
    });

    it('should handle concurrent paginated requests', async () => {
      // Arrange
      const concurrentPages = [1, 2, 3, 4, 5];
      const pageSize = 20;

      const requests = concurrentPages.map(page => {
        const startTime = performance.now();
        
        return request(app)
          .get('/api/searches')
          .query({ page, limit: pageSize })
          .then(response => ({
            page,
            status: response.status,
            dataLength: response.body.data.length,
            responseTime: performance.now() - startTime
          }));
      });

      const startTime = performance.now();

      // Act
      const responses = await Promise.all(requests);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Assert
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.dataLength).toBe(pageSize);
      });

      // Should handle concurrent pagination efficiently
      const maxResponseTime = Math.max(...responses.map(r => r.responseTime));
      expect(totalTime).toBeLessThanOrEqual(maxResponseTime * 1.2); // Allow 20% overhead
    });
  });

  describe('Resource Intensive Operations', () => {
    it('should handle heavy computation within limits', async () => {
      // Arrange
      const startTime = performance.now();

      // Act
      const response = await request(app)
        .get('/api/reports/heavy');

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1000);
      expect(response.body.meta.recordCount).toBe(1000);
      
      // Should complete heavy operation within reasonable time
      expect(totalTime).toBeLessThan(2000); // 2 seconds max
      
      // Server processing time should be tracked
      expect(response.body.meta.processingTime).toBeGreaterThan(0);
      expect(response.body.meta.processingTime).toBeLessThan(totalTime);
    });

    it('should handle multiple concurrent heavy operations', async () => {
      // Arrange
      const concurrentRequests = 3; // Limited to avoid overwhelming
      
      const requests = Array.from({ length: concurrentRequests }, (_, i) => {
        const startTime = performance.now();
        
        return request(app)
          .get('/api/reports/heavy')
          .then(response => ({
            requestId: i,
            status: response.status,
            recordCount: response.body.data.length,
            serverTime: response.body.meta.processingTime,
            clientTime: performance.now() - startTime
          }));
      });

      const startTime = performance.now();

      // Act
      const responses = await Promise.all(requests);

      const endTime = performance.now();
      const totalConcurrentTime = endTime - startTime;

      // Assert
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.recordCount).toBe(1000);
      });

      // Concurrent heavy operations should not timeout
      expect(totalConcurrentTime).toBeLessThan(5000); // 5 seconds max

      // Each individual request should still complete reasonably
      const maxClientTime = Math.max(...responses.map(r => r.clientTime));
      expect(maxClientTime).toBeLessThan(3000); // 3 seconds max per request
    });
  });

  describe('Memory Usage Patterns', () => {
    it('should handle memory efficiently during batch operations', async () => {
      // Arrange
      const initialMemory = process.memoryUsage();
      
      const largeBatch = Array.from({ length: 100 }, (_, i) => 
        TestDataBuilder.vehicle({ mobileAdId: `${200000 + i}` })
      );
      
      const payload = TestDataBuilder.webhookPayload({
        newVehicles: largeBatch
      });

      // Act
      const response = await request(app)
        .post('/api/webhooks/n8n')
        .send(payload);

      const finalMemory = process.memoryUsage();

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.processed).toBe(100);

      // Memory increase should be reasonable
      const heapUsedIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const maxAcceptableIncrease = 50 * 1024 * 1024; // 50MB
      
      expect(heapUsedIncrease).toBeLessThan(maxAcceptableIncrease);

      // Trigger garbage collection if available
      if (global.gc) {
        global.gc();
        const afterGC = process.memoryUsage();
        console.log('Memory usage:', {
          initial: Math.round(initialMemory.heapUsed / 1024 / 1024),
          final: Math.round(finalMemory.heapUsed / 1024 / 1024),
          afterGC: Math.round(afterGC.heapUsed / 1024 / 1024)
        });
      }
    });
  });

  describe('Response Time Consistency', () => {
    it('should maintain consistent response times under sustained load', async () => {
      // Arrange
      const testDuration = 5000; // 5 seconds
      const requestInterval = 100; // 100ms between requests
      const responses = [];
      
      const startTime = Date.now();
      
      // Act - Send requests at regular intervals
      while (Date.now() - startTime < testDuration) {
        const requestStart = performance.now();
        
        try {
          const response = await request(app)
            .get('/api/searches')
            .query({ page: 1, limit: 10 });
          
          const requestEnd = performance.now();
          
          responses.push({
            timestamp: Date.now() - startTime,
            responseTime: requestEnd - requestStart,
            status: response.status,
            success: response.status === 200
          });
        } catch (error) {
          responses.push({
            timestamp: Date.now() - startTime,
            responseTime: null,
            status: error.status || 500,
            success: false
          });
        }
        
        // Wait before next request
        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      // Assert
      const successfulResponses = responses.filter(r => r.success);
      expect(successfulResponses.length).toBeGreaterThan(responses.length * 0.95); // 95% success rate

      if (successfulResponses.length > 0) {
        const responseTimes = successfulResponses.map(r => r.responseTime);
        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const maxResponseTime = Math.max(...responseTimes);
        const minResponseTime = Math.min(...responseTimes);
        
        console.log('Sustained Load Results:', {
          totalRequests: responses.length,
          successfulRequests: successfulResponses.length,
          avgResponseTime: Math.round(avgResponseTime),
          minResponseTime: Math.round(minResponseTime),
          maxResponseTime: Math.round(maxResponseTime),
          responseTimeVariation: Math.round(maxResponseTime - minResponseTime)
        });

        // Response times should be consistent
        expect(avgResponseTime).toBeLessThan(500); // Average under 500ms
        expect(maxResponseTime).toBeLessThan(1500); // Max under 1.5s
        
        // Variation should be reasonable
        const variation = maxResponseTime - minResponseTime;
        expect(variation).toBeLessThan(avgResponseTime * 3); // Max 3x average
      }
    });
  });

  describe('Error Handling Under Load', () => {
    it('should maintain error handling quality under stress', async () => {
      // Arrange
      const stressRequests = 20;
      const malformedPayloads = [
        null,
        {},
        { invalid: 'payload' },
        { newVehicles: 'not-an-array' },
        { newVehicles: [null, undefined, 'invalid'] }
      ];

      const requests = [];

      for (let i = 0; i < stressRequests; i++) {
        const payload = malformedPayloads[i % malformedPayloads.length];
        
        requests.push(
          request(app)
            .post('/api/webhooks/n8n')
            .send(payload)
            .then(response => ({
              requestId: i,
              status: response.status,
              hasErrorMessage: !!response.body.error,
              responseTime: Date.now()
            }))
            .catch(error => ({
              requestId: i,
              status: error.status || 500,
              hasErrorMessage: true,
              responseTime: Date.now()
            }))
        );
      }

      const startTime = Date.now();

      // Act
      const responses = await Promise.all(requests);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Assert
      responses.forEach(response => {
        // Should handle errors gracefully, not crash
        expect([400, 422, 500]).toContain(response.status);
        expect(response.hasErrorMessage).toBe(true);
      });

      // Should complete error handling quickly even under stress
      expect(totalTime).toBeLessThan(3000); // 3 seconds for 20 requests

      console.log('Error Handling Under Stress:', {
        totalRequests: stressRequests,
        totalTime,
        avgTimePerRequest: totalTime / stressRequests
      });
    });
  });
});