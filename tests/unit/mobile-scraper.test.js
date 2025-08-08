/**
 * Unit tests for Mobile.de Scraper
 * Comprehensive test suite for scraper functionality
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } = require('@jest/globals');
const MobileDEScraper = require('../../src/services/mobile-scraper');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

// Mock external dependencies
jest.mock('puppeteer-extra');
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn()
  }
}));

jest.mock('user-agents', () => {
  return jest.fn().mockImplementation(() => ({
    toString: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }));
});

describe('MobileDEScraper', () => {
  let scraper;
  let mockBrowser;
  let mockPage;

  beforeAll(async () => {
    // Mock puppeteer browser and page
    mockPage = {
      setViewport: jest.fn(),
      setUserAgent: jest.fn(),
      setExtraHTTPHeaders: jest.fn(),
      setRequestInterception: jest.fn(),
      on: jest.fn(),
      setDefaultNavigationTimeout: jest.fn(),
      setDefaultTimeout: jest.fn(),
      goto: jest.fn(),
      waitForSelector: jest.fn(),
      content: jest.fn(),
      $eval: jest.fn(),
      removeAllListeners: jest.fn()
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn()
    };

    const puppeteerExtra = require('puppeteer-extra');
    puppeteerExtra.launch = jest.fn().mockResolvedValue(mockBrowser);
  });

  beforeEach(() => {
    scraper = new MobileDEScraper({
      maxConcurrent: 1,
      requestDelay: 100,
      timeout: 5000,
      respectRobotsTxt: false
    });
  });

  afterEach(async () => {
    if (scraper) {
      await scraper.cleanup();
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      const defaultScraper = new MobileDEScraper();
      
      expect(defaultScraper.options.maxConcurrent).toBe(3);
      expect(defaultScraper.options.requestDelay).toBe(2000);
      expect(defaultScraper.options.timeout).toBe(30000);
      expect(defaultScraper.options.maxRetries).toBe(3);
    });

    test('should initialize with custom options', () => {
      const customOptions = {
        maxConcurrent: 5,
        requestDelay: 5000,
        timeout: 60000,
        maxRetries: 5
      };
      
      const customScraper = new MobileDEScraper(customOptions);
      
      expect(customScraper.options.maxConcurrent).toBe(5);
      expect(customScraper.options.requestDelay).toBe(5000);
      expect(customScraper.options.timeout).toBe(60000);
      expect(customScraper.options.maxRetries).toBe(5);
    });

    test('should initialize browser and pages', async () => {
      await scraper.initialize();
      
      expect(scraper.browser).toBeTruthy();
      expect(scraper.pages).toHaveLength(1);
    });
  });

  describe('URL Building', () => {
    test('should build basic search URL', () => {
      const searchParams = {
        make: 'BMW',
        model: '3er'
      };
      
      const url = scraper.buildSearchUrl(searchParams);
      
      expect(url).toContain('https://www.mobile.de/fahrzeuge/search.html');
      expect(url).toContain('make=BMW');
      expect(url).toContain('model=3er');
    });

    test('should build URL with price filters', () => {
      const searchParams = {
        make: 'BMW',
        priceFrom: 10000,
        priceTo: 50000
      };
      
      const url = scraper.buildSearchUrl(searchParams);
      
      expect(url).toContain('priceFrom=10000');
      expect(url).toContain('priceTo=50000');
    });

    test('should build URL with location filters', () => {
      const searchParams = {
        make: 'Audi',
        zipcode: '10115',
        radius: 50
      };
      
      const url = scraper.buildSearchUrl(searchParams);
      
      expect(url).toContain('zipcode=10115');
      expect(url).toContain('radius=50');
    });

    test('should include sorting parameters', () => {
      const searchParams = { make: 'BMW' };
      const url = scraper.buildSearchUrl(searchParams);
      
      expect(url).toContain('sortOption.sortBy=searchResultsSort.SORT_BY_CREATION_DATE');
      expect(url).toContain('sortOption.sortDirection=DESCENDING');
      expect(url).toContain('size=50');
    });
  });

  describe('Data Extraction', () => {
    test('should parse price correctly', () => {
      expect(scraper.parsePrice('25.990 €')).toBe(25990);
      expect(scraper.parsePrice('€ 15,000')).toBe(15000);
      expect(scraper.parsePrice('Preis auf Anfrage')).toBe(null);
      expect(scraper.parsePrice('')).toBe(null);
    });

    test('should parse vehicle details from text', () => {
      const detailsText = '05/2018, 45.000 km, Diesel, Automatik, 140 kW (190 PS)';
      const details = scraper.parseVehicleDetails(detailsText);
      
      expect(details.year).toBe(2018);
      expect(details.month).toBe(5);
      expect(details.mileage).toBe(45000);
      expect(details.fuel).toBe('Diesel');
      expect(details.transmission).toBe('Automatik');
      expect(details.powerKw).toBe(140);
      expect(details.powerHp).toBe(190);
    });

    test('should extract vehicles from HTML content', async () => {
      const mockHtml = `
        <div data-testid="result-item">
          <div class="headline-block">
            <h2><a href="/fahrzeuge/details/bmw-320d-12345">BMW 320d xDrive</a></h2>
          </div>
          <div class="price-block">
            <span class="u-text-orange">24.990 €</span>
          </div>
          <div class="vehicle-data">05/2018, 45.000 km, Diesel, Automatik</div>
          <div class="seller-info__location">Berlin</div>
          <div class="seller-info">Händler</div>
          <img src="/img/vehicle/123.jpg" alt="BMW">
        </div>
      `;
      
      const vehicles = await scraper.extractVehicleData(mockHtml, 'test-search-id');
      
      expect(vehicles).toHaveLength(1);
      expect(vehicles[0]).toMatchObject({
        title: 'BMW 320d xDrive',
        price: 24990,
        url: 'https://www.mobile.de/fahrzeuge/details/bmw-320d-12345',
        location: 'Berlin',
        sellerType: 'dealer',
        year: 2018,
        month: 5,
        mileage: 45000,
        fuel: 'Diesel',
        transmission: 'Automatik'
      });
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting between requests', async () => {
      scraper.options.requestDelay = 1000;
      
      const start = Date.now();
      await scraper.applyRateLimit();
      await scraper.applyRateLimit();
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(1000);
    });

    test('should track request count', async () => {
      const initialCount = scraper.requestCount;
      
      await scraper.applyRateLimit();
      await scraper.applyRateLimit();
      
      expect(scraper.requestCount).toBe(initialCount + 2);
    });
  });

  describe('Proxy Management', () => {
    test('should get next proxy from list', () => {
      scraper.options.proxyList = ['proxy1:8080', 'proxy2:8080', 'proxy3:8080'];
      
      const proxy1 = scraper.getNextProxy();
      const proxy2 = scraper.getNextProxy();
      const proxy3 = scraper.getNextProxy();
      const proxy4 = scraper.getNextProxy(); // Should wrap around
      
      expect(proxy1).toBe('proxy1:8080');
      expect(proxy2).toBe('proxy2:8080');
      expect(proxy3).toBe('proxy3:8080');
      expect(proxy4).toBe('proxy1:8080');
    });

    test('should skip blocked proxies', () => {
      scraper.options.proxyList = ['proxy1:8080', 'proxy2:8080', 'proxy3:8080'];
      scraper.markProxyBlocked('proxy2:8080');
      
      const proxy1 = scraper.getNextProxy();
      const proxy2 = scraper.getNextProxy();
      
      expect(proxy1).toBe('proxy1:8080');
      expect(proxy2).toBe('proxy3:8080');
    });

    test('should return null when no proxies available', () => {
      scraper.options.proxyList = [];
      const proxy = scraper.getNextProxy();
      
      expect(proxy).toBe(null);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      await scraper.initialize();
      
      // Mock successful response
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.waitForSelector.mockResolvedValue();
      mockPage.content.mockResolvedValue(`
        <div data-testid="result-item">
          <div class="headline-block">
            <h2><a href="/fahrzeuge/details/test-123">Test Vehicle</a></h2>
          </div>
          <div class="price-block">
            <span class="u-text-orange">20.000 €</span>
          </div>
        </div>
      `);
      mockPage.$eval.mockRejectedValue(new Error('No pagination'));
    });

    test('should perform basic vehicle search', async () => {
      const searchParams = {
        make: 'BMW',
        model: '3er',
        priceFrom: 10000,
        priceTo: 50000
      };
      
      const results = await scraper.searchVehicles(searchParams);
      
      expect(results).toBeArray();
      expect(mockPage.goto).toHaveBeenCalled();
    });

    test('should handle search errors gracefully', async () => {
      mockPage.goto.mockRejectedValue(new Error('Network error'));
      
      const searchParams = { make: 'BMW' };
      
      await expect(scraper.searchVehicles(searchParams)).rejects.toThrow('Network error');
    });

    test('should retry failed requests', async () => {
      // First call fails, second succeeds
      mockPage.goto
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValue({ status: () => 200 });
      
      const searchParams = { make: 'BMW' };
      
      const results = await scraper.searchVehicles(searchParams);
      
      expect(mockPage.goto).toHaveBeenCalledTimes(2);
      expect(results).toBeArray();
    });
  });

  describe('Detail Scraping', () => {
    beforeEach(async () => {
      await scraper.initialize();
    });

    test('should scrape vehicle details', async () => {
      const mockDetailHtml = `
        <div class="vehicle-description">Detailed description here</div>
        <div class="vehicle-data-table">
          <tr><td>Erstzulassung</td><td>05/2018</td></tr>
          <tr><td>Kilometerstand</td><td>45.000 km</td></tr>
        </div>
        <div class="equipment-list">
          <li>Navigation</li>
          <li>Klimaanlage</li>
        </div>
      `;
      
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.waitForSelector.mockResolvedValue();
      mockPage.content.mockResolvedValue(mockDetailHtml);
      
      const details = await scraper.scrapeVehicleDetails('https://www.mobile.de/test');
      
      expect(details).toHaveProperty('description');
      expect(details).toHaveProperty('features');
      expect(details.features).toContain('Navigation');
      expect(details.features).toContain('Klimaanlage');
    });
  });

  describe('Statistics', () => {
    test('should provide accurate statistics', () => {
      scraper.requestCount = 10;
      scraper.markProxyBlocked('proxy1:8080');
      
      const stats = scraper.getStats();
      
      expect(stats.requestCount).toBe(10);
      expect(stats.blockedProxies).toBe(1);
      expect(stats.activePagesCount).toBe(0);
      expect(stats).toHaveProperty('lastRequest');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', async () => {
      await scraper.initialize();
      await scraper.cleanup();
      
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(scraper.browser).toBe(null);
      expect(scraper.pages).toHaveLength(0);
    });
  });

  describe('Robots.txt Compliance', () => {
    test('should check robots.txt when enabled', async () => {
      // Mock fetch for robots.txt
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`
          User-agent: *
          Disallow: /admin
          Allow: /fahrzeuge
        `)
      });
      
      scraper.options.respectRobotsTxt = true;
      const allowed = await scraper.checkRobotsTxt();
      
      expect(allowed).toBe(true);
      expect(fetch).toHaveBeenCalledWith('https://www.mobile.de/robots.txt');
    });

    test('should disallow when robots.txt forbids', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`
          User-agent: *
          Disallow: /fahrzeuge
        `)
      });
      
      scraper.options.respectRobotsTxt = true;
      const allowed = await scraper.checkRobotsTxt();
      
      expect(allowed).toBe(false);
    });

    test('should allow when robots.txt check is disabled', async () => {
      scraper.options.respectRobotsTxt = false;
      const allowed = await scraper.checkRobotsTxt();
      
      expect(allowed).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle blocked responses', async () => {
      await scraper.initialize();
      
      mockPage.goto.mockResolvedValue({ status: () => 403 });
      
      const searchParams = { make: 'BMW' };
      
      await expect(scraper.searchVehicles(searchParams)).rejects.toThrow('Blocked by server: 403');
    });

    test('should handle missing selectors gracefully', async () => {
      const mockHtml = '<div>No vehicle results here</div>';
      const vehicles = await scraper.extractVehicleData(mockHtml, 'test-id');
      
      expect(vehicles).toHaveLength(0);
    });
  });
});

// Helper matchers
expect.extend({
  toBeArray(received) {
    const pass = Array.isArray(received);
    return {
      message: () => `expected ${received} to be an array`,
      pass
    };
  }
});