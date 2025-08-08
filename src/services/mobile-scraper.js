/**
 * Mobile.de Web Scraper
 * Robust scraping engine with proxy rotation, error handling, and anti-detection measures
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const UserAgent = require('user-agents');
const cheerio = require('cheerio');
const winston = require('winston');
const async = require('async');
const { v4: uuidv4 } = require('uuid');

// Add stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/mobile-scraper-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/mobile-scraper.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class MobileDEScraper {
  constructor(options = {}) {
    this.options = {
      maxConcurrent: options.maxConcurrent || 3,
      requestDelay: options.requestDelay || 2000,
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      useProxy: options.useProxy || false,
      proxyList: options.proxyList || [],
      respectRobotsTxt: options.respectRobotsTxt !== false,
      ...options
    };

    this.browser = null;
    this.pages = [];
    this.userAgentGenerator = new UserAgent([
      /Chrome/,
      /Windows/
    ]);
    
    // Rate limiting
    this.lastRequest = 0;
    this.requestCount = 0;
    this.hourlyRequestLimit = 500;
    this.dailyRequestLimit = 5000;
    
    // Proxy rotation
    this.currentProxyIndex = 0;
    this.blockedProxies = new Set();
    
    // Anti-detection measures
    this.viewportSizes = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1536, height: 864 }
    ];
  }

  /**
   * Initialize the scraper
   */
  async initialize() {
    try {
      logger.info('Initializing Mobile.de scraper...');
      
      const launchOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--lang=de-DE,de,en-US,en'
        ],
        defaultViewport: null
      };

      // Add proxy if configured
      if (this.options.useProxy && this.options.proxyList.length > 0) {
        const proxy = this.getNextProxy();
        if (proxy) {
          launchOptions.args.push(`--proxy-server=${proxy}`);
        }
      }

      this.browser = await puppeteer.launch(launchOptions);
      
      // Create initial pages
      for (let i = 0; i < this.options.maxConcurrent; i++) {
        const page = await this.createPage();
        this.pages.push(page);
      }

      logger.info(`Scraper initialized with ${this.pages.length} concurrent pages`);
    } catch (error) {
      logger.error('Failed to initialize scraper:', error);
      throw error;
    }
  }

  /**
   * Create a properly configured page
   */
  async createPage() {
    const page = await this.browser.newPage();
    
    // Set random viewport
    const viewport = this.viewportSizes[Math.floor(Math.random() * this.viewportSizes.length)];
    await page.setViewport(viewport);
    
    // Set random user agent
    const userAgent = this.userAgentGenerator.toString();
    await page.setUserAgent(userAgent);
    
    // Set language preferences
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
    });

    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (resourceType === 'stylesheet' || 
          resourceType === 'font' || 
          resourceType === 'image' && !req.url().includes('mobile.de')) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Handle navigation timeout
    page.setDefaultNavigationTimeout(this.options.timeout);
    page.setDefaultTimeout(this.options.timeout);

    return page;
  }

  /**
   * Get next available proxy
   */
  getNextProxy() {
    if (!this.options.proxyList.length) return null;
    
    for (let i = 0; i < this.options.proxyList.length; i++) {
      const proxyIndex = (this.currentProxyIndex + i) % this.options.proxyList.length;
      const proxy = this.options.proxyList[proxyIndex];
      
      if (!this.blockedProxies.has(proxy)) {
        this.currentProxyIndex = (proxyIndex + 1) % this.options.proxyList.length;
        return proxy;
      }
    }
    
    return null;
  }

  /**
   * Mark proxy as blocked
   */
  markProxyBlocked(proxy) {
    this.blockedProxies.add(proxy);
    logger.warn(`Proxy ${proxy} marked as blocked`);
  }

  /**
   * Apply rate limiting
   */
  async applyRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.options.requestDelay) {
      const delay = this.options.requestDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequest = Date.now();
    this.requestCount++;
  }

  /**
   * Search for vehicles on Mobile.de
   */
  async searchVehicles(searchParams) {
    const searchId = uuidv4();
    logger.info(`Starting search ${searchId}:`, searchParams);
    
    try {
      const searchUrl = this.buildSearchUrl(searchParams);
      logger.info(`Built search URL: ${searchUrl}`);
      
      const results = await this.scrapeSearchResults(searchUrl, searchId);
      
      logger.info(`Search ${searchId} completed: ${results.length} vehicles found`);
      return results;
      
    } catch (error) {
      logger.error(`Search ${searchId} failed:`, error);
      throw error;
    }
  }

  /**
   * Build Mobile.de search URL
   */
  buildSearchUrl(params) {
    const baseUrl = 'https://www.mobile.de/fahrzeuge/search.html';
    const urlParams = new URLSearchParams();

    // Basic search parameters
    if (params.make) urlParams.set('make', params.make);
    if (params.model) urlParams.set('model', params.model);
    if (params.category) urlParams.set('category', params.category);

    // Price range
    if (params.priceFrom) urlParams.set('priceFrom', params.priceFrom);
    if (params.priceTo) urlParams.set('priceTo', params.priceTo);

    // Year range  
    if (params.yearFrom) urlParams.set('yearFrom', params.yearFrom);
    if (params.yearTo) urlParams.set('yearTo', params.yearTo);

    // Mileage
    if (params.mileageFrom) urlParams.set('mileageFrom', params.mileageFrom);
    if (params.mileageTo) urlParams.set('mileageTo', params.mileageTo);

    // Fuel and transmission
    if (params.fuel) urlParams.set('fuel', params.fuel);
    if (params.transmission) urlParams.set('transmission', params.transmission);

    // Location
    if (params.zipcode) {
      urlParams.set('zipcode', params.zipcode);
      if (params.radius) urlParams.set('radius', params.radius);
    }

    // Additional filters
    if (params.power) urlParams.set('power', params.power);
    if (params.condition) urlParams.set('condition', params.condition);
    if (params.sellerType) urlParams.set('sellerType', params.sellerType);
    
    // Sort by newest first
    urlParams.set('sortOption.sortBy', 'searchResultsSort.SORT_BY_CREATION_DATE');
    urlParams.set('sortOption.sortDirection', 'DESCENDING');
    
    // Page size
    urlParams.set('size', '50');

    return `${baseUrl}?${urlParams.toString()}`;
  }

  /**
   * Scrape search results from Mobile.de
   */
  async scrapeSearchResults(searchUrl, searchId) {
    let page = null;
    let retryCount = 0;
    
    while (retryCount < this.options.maxRetries) {
      try {
        await this.applyRateLimit();
        
        // Get available page
        page = await this.getAvailablePage();
        
        logger.info(`Navigating to search URL (attempt ${retryCount + 1})`);
        
        // Navigate to search page
        const response = await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: this.options.timeout
        });

        // Check for blocked response
        if (response.status() === 403 || response.status() === 429) {
          throw new Error(`Blocked by server: ${response.status()}`);
        }

        // Wait for results to load
        await page.waitForSelector('[data-testid="result-list"]', { 
          timeout: 10000 
        }).catch(() => {
          // Continue if results container not found immediately
          logger.warn('Results container not found immediately, continuing...');
        });

        // Additional wait for dynamic content
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extract page content
        const content = await page.content();
        const vehicles = await this.extractVehicleData(content, searchId);

        // Check for pagination and scrape additional pages
        const totalPages = await this.getTotalPages(page);
        if (totalPages > 1) {
          const additionalVehicles = await this.scrapeMultiplePages(searchUrl, totalPages, searchId);
          vehicles.push(...additionalVehicles);
        }

        this.releasePage(page);
        return vehicles;

      } catch (error) {
        logger.error(`Scraping attempt ${retryCount + 1} failed:`, error);
        
        if (page) {
          this.releasePage(page);
        }
        
        retryCount++;
        
        if (retryCount < this.options.maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, retryCount) * 1000;
          logger.info(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Extract vehicle data from HTML content
   */
  async extractVehicleData(html, searchId) {
    const $ = cheerio.load(html);
    const vehicles = [];

    // Find vehicle result items
    $('[data-testid="result-item"], .cBox-body--resultitem').each((index, element) => {
      try {
        const $item = $(element);
        
        // Extract basic information
        const title = $item.find('.headline-block h2 a, .result-item__header h2 a').text().trim();
        const priceText = $item.find('.price-block .u-text-orange, .result-item__price .price').first().text().trim();
        const price = this.parsePrice(priceText);
        
        // Extract details
        const detailsText = $item.find('.vehicle-data, .result-item__details').text();
        const details = this.parseVehicleDetails(detailsText);
        
        // Extract URL
        const relativeUrl = $item.find('.headline-block h2 a, .result-item__header h2 a').attr('href');
        const url = relativeUrl ? `https://www.mobile.de${relativeUrl}` : null;
        
        // Extract location
        const location = $item.find('.seller-info__location, .result-item__location').text().trim();
        
        // Extract seller type
        const sellerInfo = $item.find('.seller-info, .result-item__seller').text();
        const sellerType = sellerInfo.includes('Händler') ? 'dealer' : 'private';
        
        // Extract image
        const imageUrl = $item.find('img').first().attr('src') || $item.find('img').first().attr('data-src');
        
        if (title && url) {
          const vehicle = {
            id: uuidv4(),
            searchId,
            title,
            price,
            currency: 'EUR',
            url,
            location,
            sellerType,
            imageUrl,
            scrapedAt: new Date().toISOString(),
            source: 'mobile.de',
            ...details
          };
          
          vehicles.push(vehicle);
        }
        
      } catch (itemError) {
        logger.warn(`Error extracting vehicle ${index}:`, itemError);
      }
    });

    logger.info(`Extracted ${vehicles.length} vehicles from page`);
    return vehicles;
  }

  /**
   * Parse price from text
   */
  parsePrice(priceText) {
    if (!priceText) return null;
    
    const match = priceText.replace(/[^\d,.-]/g, '').replace(',', '');
    return match ? parseFloat(match) : null;
  }

  /**
   * Parse vehicle details from text
   */
  parseVehicleDetails(detailsText) {
    const details = {};
    
    if (!detailsText) return details;
    
    // Extract year
    const yearMatch = detailsText.match(/(\d{2})\/(\d{4})/);
    if (yearMatch) {
      details.year = parseInt(yearMatch[2]);
      details.month = parseInt(yearMatch[1]);
    }
    
    // Extract mileage
    const mileageMatch = detailsText.match(/([\d.,]+)\s*km/i);
    if (mileageMatch) {
      details.mileage = parseInt(mileageMatch[1].replace(/[.,]/g, ''));
    }
    
    // Extract fuel type
    if (detailsText.includes('Benzin')) details.fuel = 'Benzin';
    if (detailsText.includes('Diesel')) details.fuel = 'Diesel';
    if (detailsText.includes('Elektro')) details.fuel = 'Elektro';
    if (detailsText.includes('Hybrid')) details.fuel = 'Hybrid';
    
    // Extract transmission
    if (detailsText.includes('Automatik')) details.transmission = 'Automatik';
    if (detailsText.includes('Manuell')) details.transmission = 'Manuell';
    if (detailsText.includes('Schaltgetriebe')) details.transmission = 'Manuell';
    
    // Extract power
    const powerMatch = detailsText.match(/(\d+)\s*kW\s*\((\d+)\s*PS\)/i);
    if (powerMatch) {
      details.powerKw = parseInt(powerMatch[1]);
      details.powerHp = parseInt(powerMatch[2]);
    }
    
    return details;
  }

  /**
   * Get total pages from pagination
   */
  async getTotalPages(page) {
    try {
      const paginationText = await page.$eval('.pagination, .u-pagination', el => el.textContent).catch(() => null);
      if (!paginationText) return 1;
      
      const match = paginationText.match(/Seite\s+\d+\s+von\s+(\d+)/i) || 
                   paginationText.match(/von\s+(\d+)/i);
      
      return match ? parseInt(match[1]) : 1;
    } catch (error) {
      return 1;
    }
  }

  /**
   * Scrape multiple pages
   */
  async scrapeMultiplePages(baseUrl, totalPages, searchId) {
    const allVehicles = [];
    const maxPages = Math.min(totalPages, 10); // Limit to 10 pages for now
    
    const pageQueue = async.queue(async (pageNum) => {
      try {
        const pageUrl = `${baseUrl}&page=${pageNum}`;
        logger.info(`Scraping page ${pageNum}/${maxPages}`);
        
        const vehicles = await this.scrapeSearchResults(pageUrl, searchId);
        allVehicles.push(...vehicles);
        
      } catch (error) {
        logger.error(`Failed to scrape page ${pageNum}:`, error);
      }
    }, 2); // Max 2 concurrent page requests
    
    // Add pages to queue (skip first page as it's already scraped)
    for (let i = 2; i <= maxPages; i++) {
      pageQueue.push(i);
    }
    
    await pageQueue.drain();
    
    return allVehicles;
  }

  /**
   * Get available page from pool
   */
  async getAvailablePage() {
    // Simple round-robin for now
    return this.pages[this.requestCount % this.pages.length];
  }

  /**
   * Release page back to pool
   */
  releasePage(page) {
    // Clear page state
    page.removeAllListeners();
  }

  /**
   * Scrape detailed vehicle information
   */
  async scrapeVehicleDetails(vehicleUrl) {
    let page = null;
    
    try {
      await this.applyRateLimit();
      page = await this.getAvailablePage();
      
      logger.info(`Scraping vehicle details: ${vehicleUrl}`);
      
      await page.goto(vehicleUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.options.timeout
      });
      
      // Wait for main content to load
      await page.waitForSelector('.description, .vehicle-details', { timeout: 10000 }).catch(() => {});
      
      const content = await page.content();
      const details = await this.extractDetailedVehicleData(content);
      
      this.releasePage(page);
      return details;
      
    } catch (error) {
      logger.error(`Failed to scrape vehicle details: ${vehicleUrl}`, error);
      if (page) this.releasePage(page);
      throw error;
    }
  }

  /**
   * Extract detailed vehicle data from detail page
   */
  async extractDetailedVehicleData(html) {
    const $ = cheerio.load(html);
    const details = {};
    
    // Extract description
    details.description = $('.description, .vehicle-description').text().trim();
    
    // Extract all images
    const images = [];
    $('img[src*="vehicle"]').each((i, img) => {
      const src = $(img).attr('src') || $(img).attr('data-src');
      if (src && !images.includes(src)) {
        images.push(src);
      }
    });
    details.images = images;
    
    // Extract technical specifications
    $('.vehicle-data-table tr, .specifications tr').each((i, row) => {
      const $row = $(row);
      const label = $row.find('td:first-child, th').text().trim().toLowerCase();
      const value = $row.find('td:last-child').text().trim();
      
      if (label && value) {
        // Map common specifications
        if (label.includes('erstzulassung')) details.firstRegistration = value;
        if (label.includes('kilometerstand')) details.detailedMileage = value;
        if (label.includes('kraftstoff')) details.detailedFuel = value;
        if (label.includes('getriebe')) details.detailedTransmission = value;
        if (label.includes('farbe')) details.color = value;
        if (label.includes('türen')) details.doors = value;
        if (label.includes('sitze')) details.seats = value;
        if (label.includes('hubraum')) details.displacement = value;
        if (label.includes('verbrauch')) details.consumption = value;
        if (label.includes('co2')) details.co2Emission = value;
      }
    });
    
    // Extract seller information
    details.sellerName = $('.seller-name, .dealer-name').text().trim();
    details.sellerPhone = $('[href^="tel:"]').text().trim();
    details.sellerAddress = $('.seller-address, .dealer-address').text().trim();
    
    // Extract features/equipment
    const features = [];
    $('.equipment-list li, .features li').each((i, feature) => {
      const featureText = $(feature).text().trim();
      if (featureText) features.push(featureText);
    });
    details.features = features;
    
    return details;
  }

  /**
   * Check if robots.txt allows scraping
   */
  async checkRobotsTxt() {
    if (!this.options.respectRobotsTxt) return true;
    
    try {
      const response = await fetch('https://www.mobile.de/robots.txt');
      const robotsTxt = await response.text();
      
      // Simple check for User-agent: * and Disallow rules
      const lines = robotsTxt.split('\n');
      let userAgentMatch = false;
      
      for (const line of lines) {
        if (line.toLowerCase().includes('user-agent: *')) {
          userAgentMatch = true;
        }
        if (userAgentMatch && line.toLowerCase().includes('disallow: /fahrzeuge')) {
          logger.warn('Robots.txt disallows scraping /fahrzeuge');
          return false;
        }
      }
      
      return true;
    } catch (error) {
      logger.warn('Could not check robots.txt:', error);
      return true; // Default to allowed if we can't check
    }
  }

  /**
   * Get scraper statistics
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      blockedProxies: this.blockedProxies.size,
      activePagesCount: this.pages.length,
      lastRequest: this.lastRequest
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.pages = [];
      logger.info('Scraper cleaned up successfully');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

module.exports = MobileDEScraper;