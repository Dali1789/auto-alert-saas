/**
 * Test Data Fixtures for Auto Alert SaaS
 * London School TDD approach with object mother pattern
 */

class TestDataBuilder {
  static vehicle(overrides = {}) {
    return {
      mobileAdId: '12345',
      title: 'BMW 740d xDrive',
      make: 'BMW',
      model: '7er',
      modelDescription: '740d xDrive',
      price: 22500,
      currency: 'EUR',
      year: 2018,
      month: 8,
      mileage: 89000,
      fuel: 'Diesel',
      gearbox: 'Automatik',
      power: 235,
      powerHP: 320,
      condition: 'Gebraucht',
      damageUnrepaired: false,
      accidentDamaged: false,
      roadworthy: true,
      category: 'Limousine',
      doors: 4,
      seats: 5,
      exteriorColor: 'Schwarz',
      interiorColor: 'Schwarz',
      sellerType: 'Händler',
      sellerCity: 'München',
      sellerZipcode: '80331',
      sellerCompany: 'BMW Autohaus München',
      sellerCommercial: true,
      detailUrl: 'https://suchen.mobile.de/fahrzeuge/details.html?id=12345',
      creationDate: '2024-01-15T10:30:00Z',
      modificationDate: '2024-01-15T10:30:00Z',
      features: ['Klimaautomatik', 'Navigation', 'Ledersitze'],
      images: [
        'https://img.mobile.de/1.jpg',
        'https://img.mobile.de/2.jpg'
      ],
      description: 'Sehr gepflegter BMW 740d xDrive in Top-Zustand...',
      location: 'München, 80331',
      ...overrides
    };
  }

  static user(overrides = {}) {
    return {
      id: 'user_123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'Test User',
      phone: '+4915123456789',
      retell_phone_number: '+4915123456789',
      notification_preferences: {
        email: true,
        voice: true,
        sms: false,
        push: false
      },
      subscription_tier: 'premium',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      ...overrides
    };
  }

  static search(overrides = {}) {
    return {
      id: 'search_123e4567-e89b-12d3-a456-426614174000',
      user_id: 'user_123e4567-e89b-12d3-a456-426614174000',
      name: 'BMW 7er Search',
      make: 'BMW',
      model: '7er',
      model_description: '740d',
      category: 'Limousine',
      price_min: 15000,
      price_max: 35000,
      year_min: 2015,
      year_max: 2022,
      mileage_max: 150000,
      fuel: 'Diesel',
      gearbox: 'Automatik',
      condition: 'Gebraucht',
      seller_type: null,
      damage_allowed: false,
      zipcode: '80331',
      radius: 50,
      features: ['Klimaautomatik', 'Navigation'],
      exclude_export: true,
      only_with_images: true,
      notification_methods: ['email', 'voice'],
      is_active: true,
      last_run: '2024-01-15T10:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
      ...overrides
    };
  }

  static notification(overrides = {}) {
    return {
      id: 'notif_123e4567-e89b-12d3-a456-426614174000',
      user_id: 'user_123e4567-e89b-12d3-a456-426614174000',
      search_id: 'search_123e4567-e89b-12d3-a456-426614174000',
      result_id: 'result_123e4567-e89b-12d3-a456-426614174000',
      notification_type: 'email',
      status: 'sent',
      provider: 'resend',
      provider_id: 'email_abc123',
      error_message: null,
      sent_at: '2024-01-15T10:30:00Z',
      delivered_at: null,
      opened_at: null,
      clicked_at: null,
      created_at: '2024-01-15T10:30:00Z',
      ...overrides
    };
  }

  static result(overrides = {}) {
    return {
      id: 'result_123e4567-e89b-12d3-a456-426614174000',
      search_id: 'search_123e4567-e89b-12d3-a456-426614174000',
      mobile_ad_id: '12345',
      portal: 'mobile.de',
      title: 'BMW 740d xDrive',
      make: 'BMW',
      model: '7er',
      model_description: '740d xDrive',
      price: 22500,
      year: 2018,
      mileage: 89000,
      fuel: 'Diesel',
      gearbox: 'Automatik',
      power: 235,
      damage_unrepaired: false,
      accident_damaged: false,
      detail_url: 'https://suchen.mobile.de/fahrzeuge/details.html?id=12345',
      seller_type: 'Händler',
      seller_city: 'München',
      seller_zipcode: '80331',
      seller_company: 'BMW Autohaus München',
      notified_at: '2024-01-15T10:30:00Z',
      notification_methods_sent: ['email', 'voice'],
      first_seen: '2024-01-15T10:00:00Z',
      last_seen: '2024-01-15T10:30:00Z',
      ...overrides
    };
  }

  static apiResponse(overrides = {}) {
    return {
      ads: [
        {
          mobileAdId: '12345',
          make: 'BMW',
          model: '7er',
          modelDescription: '740d xDrive',
          price: {
            consumerPriceGross: '22500',
            currency: 'EUR',
            type: 'FIXED'
          },
          firstRegistration: '201808',
          mileage: 89000,
          fuel: 'DIESEL',
          gearbox: 'AUTOMATIC',
          power: 235,
          condition: 'USED',
          damageUnrepaired: false,
          accidentDamaged: false,
          roadworthy: true,
          category: 'SEDAN',
          doorCount: 4,
          numSeats: 5,
          exteriorColor: 'BLACK',
          interiorColor: 'BLACK',
          seller: {
            type: 'DEALER',
            address: {
              city: 'München',
              zipcode: '80331'
            },
            companyName: 'BMW Autohaus München',
            commercial: true
          },
          detailPageUrl: 'https://suchen.mobile.de/fahrzeuge/details.html?id=12345',
          creationDate: '2024-01-15T10:30:00Z',
          modificationDate: '2024-01-15T10:30:00Z',
          features: ['AIR_CONDITIONING', 'NAVIGATION', 'LEATHER_SEATS'],
          images: [
            'https://img.mobile.de/1.jpg',
            'https://img.mobile.de/2.jpg'
          ],
          plainTextDescription: 'Sehr gepflegter BMW 740d xDrive in Top-Zustand...'
        }
      ],
      totalResults: 1,
      page: 1,
      pageSize: 100,
      ...overrides
    };
  }

  static webhookPayload(overrides = {}) {
    return {
      searchId: 'search_123e4567-e89b-12d3-a456-426614174000',
      newVehicles: [this.vehicle()],
      timestamp: '2024-01-15T10:30:00Z',
      source: 'n8n-scraper',
      ...overrides
    };
  }

  static retellCallData(overrides = {}) {
    return {
      fromNumber: '+4915123456789',
      toNumber: '+4915987654321',
      retellLlmDynamicVariables: {
        car_title: 'BMW 740d xDrive',
        car_price: '22500',
        car_year: '2018',
        car_mileage: '89000',
        car_location: 'München, 80331',
        car_url: 'https://suchen.mobile.de/fahrzeuge/details.html?id=12345',
        urgency_level: 'medium'
      },
      overrideAgentId: 'agent_123',
      ...overrides
    };
  }

  static emailData(overrides = {}) {
    return {
      from: 'Auto-Alert <alerts@autoalert.com>',
      to: ['test@example.com'],
      subject: '🚗 Neues Fahrzeug gefunden: BMW 740d xDrive',
      html: '<html><body><h1>Neues Fahrzeug gefunden!</h1></body></html>',
      ...overrides
    };
  }

  static fileData(overrides = {}) {
    return {
      originalname: 'test-image.jpg',
      buffer: Buffer.from('fake-image-data'),
      mimetype: 'image/jpeg',
      size: 1024,
      ...overrides
    };
  }

  static performanceMetrics(overrides = {}) {
    return {
      timestamp: new Date(),
      cpu: {
        usage: 45.2,
        loadAverage: [1.2, 1.5, 1.3],
        cores: 4
      },
      memory: {
        processHeapUsed: 52428800,
        processHeapTotal: 67108864,
        processRSS: 104857600,
        systemTotal: 8589934592,
        systemUsed: 6442450944,
        systemFree: 2147483648,
        systemUsagePercent: 75.0
      },
      database: {
        active_connections: 5,
        cacheHitRatio: 95.2,
        transactions_committed: 1000,
        tuples_returned: 50000
      },
      redis: {
        connectedClients: 3,
        usedMemory: 1048576,
        hitRate: 87.5,
        instantaneousOpsPerSec: 15
      },
      application: {
        uptime: 86400,
        totalQueries: 1250,
        slowQueries: 3,
        averageQueryTime: 45.2,
        activeConnections: 2
      },
      ...overrides
    };
  }
}

// Scenario builders for complex test cases
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
      user: TestDataBuilder.user({
        notification_preferences: {
          email: true,
          voice: true,
          sms: true,
          push: true
        }
      }),
      search: TestDataBuilder.search({
        price_max: 30000,
        notification_methods: ['email', 'voice', 'sms']
      }),
      vehicle: TestDataBuilder.vehicle({
        price: 18000 // Well below max price
      }),
      expectedUrgency: 'high'
    };
  }

  static failedNotification() {
    return {
      user: TestDataBuilder.user(),
      search: TestDataBuilder.search(),
      vehicle: TestDataBuilder.vehicle(),
      notificationError: 'API rate limit exceeded',
      expectedRetries: 3
    };
  }

  static bulkImageUpload() {
    return {
      user: TestDataBuilder.user(),
      vehicle: TestDataBuilder.vehicle(),
      images: Array.from({ length: 5 }, (_, i) => 
        TestDataBuilder.fileData({
          originalname: `image-${i + 1}.jpg`
        })
      )
    };
  }

  static performanceAlert() {
    return {
      metrics: TestDataBuilder.performanceMetrics({
        cpu: { usage: 95.5 }, // Above threshold
        memory: { systemUsagePercent: 90.2 } // Above threshold
      }),
      expectedAlerts: ['cpu_high', 'memory_high']
    };
  }

  static slowQueryDetection() {
    return {
      queryData: {
        text: 'SELECT * FROM large_table WHERE unindexed_column LIKE %search%',
        executionTime: 2500, // Above threshold
        rowsReturned: 50000
      },
      expectedAlert: 'slow_query',
      expectedOptimizationFlag: true
    };
  }
}

// Mock data generators
class MockDataGenerator {
  static generateVehicles(count = 10) {
    return Array.from({ length: count }, (_, i) => 
      TestDataBuilder.vehicle({
        mobileAdId: `${12345 + i}`,
        title: `Test Vehicle ${i + 1}`,
        price: 20000 + (i * 1000)
      })
    );
  }

  static generateUsers(count = 5) {
    return Array.from({ length: count }, (_, i) => 
      TestDataBuilder.user({
        id: `user_${i + 1}`,
        email: `test${i + 1}@example.com`
      })
    );
  }

  static generateSearches(userId, count = 3) {
    return Array.from({ length: count }, (_, i) => 
      TestDataBuilder.search({
        id: `search_${i + 1}`,
        user_id: userId,
        name: `Search ${i + 1}`,
        make: ['BMW', 'Mercedes', 'Audi'][i % 3]
      })
    );
  }

  static generateNotifications(userId, count = 10) {
    return Array.from({ length: count }, (_, i) => 
      TestDataBuilder.notification({
        id: `notif_${i + 1}`,
        user_id: userId,
        notification_type: ['email', 'voice', 'sms'][i % 3],
        status: ['sent', 'delivered', 'failed'][i % 3]
      })
    );
  }
}

module.exports = {
  TestDataBuilder,
  ScenarioBuilder,
  MockDataGenerator
};