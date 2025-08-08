/**
 * Utility functions for Mobile.de scraper
 * Helper functions for data processing, validation, and scraper utilities
 */

const crypto = require('crypto');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

/**
 * Vehicle data normalization and validation utilities
 */
class VehicleDataProcessor {
  /**
   * Normalize vehicle data structure
   */
  static normalizeVehicle(rawVehicle) {
    const normalized = {
      // Core identifiers
      id: rawVehicle.id || this.generateVehicleId(rawVehicle),
      mobileDeId: this.extractMobileDeId(rawVehicle.url),
      url: rawVehicle.url,
      
      // Basic information
      title: this.sanitizeString(rawVehicle.title),
      make: this.sanitizeString(rawVehicle.make),
      model: this.sanitizeString(rawVehicle.model),
      
      // Pricing
      price: this.normalizePrice(rawVehicle.price),
      currency: rawVehicle.currency || 'EUR',
      priceType: rawVehicle.priceType || 'fixed',
      
      // Technical details
      year: this.normalizeYear(rawVehicle.year),
      month: this.normalizeMonth(rawVehicle.month),
      mileage: this.normalizeMileage(rawVehicle.mileage),
      fuel: this.normalizeFuelType(rawVehicle.fuel),
      transmission: this.normalizeTransmission(rawVehicle.transmission),
      power: this.normalizePower(rawVehicle.power),
      
      // Physical attributes
      doors: this.normalizeDoors(rawVehicle.doors),
      seats: this.normalizeSeats(rawVehicle.seats),
      color: this.sanitizeString(rawVehicle.color),
      category: this.normalizeCategory(rawVehicle.category),
      
      // Condition and damage
      condition: this.normalizeCondition(rawVehicle.condition),
      damageUnrepaired: Boolean(rawVehicle.damageUnrepaired),
      accidentDamaged: Boolean(rawVehicle.accidentDamaged),
      
      // Seller information
      sellerType: this.normalizeSellerType(rawVehicle.sellerType),
      location: this.sanitizeString(rawVehicle.location),
      zipcode: this.normalizeZipcode(rawVehicle.zipcode),
      
      // Images and media
      images: this.normalizeImages(rawVehicle.images || []),
      imageCount: rawVehicle.images?.length || 0,
      
      // Features and equipment
      features: this.normalizeFeatures(rawVehicle.features || []),
      
      // Metadata
      scrapedAt: rawVehicle.scrapedAt || new Date().toISOString(),
      source: rawVehicle.source || 'mobile.de',
      lastUpdated: new Date().toISOString()
    };
    
    // Add calculated fields
    normalized.ageInYears = this.calculateVehicleAge(normalized.year, normalized.month);
    normalized.pricePerYear = this.calculatePricePerYear(normalized.price, normalized.ageInYears);
    normalized.searchKeywords = this.generateSearchKeywords(normalized);
    
    return normalized;
  }

  /**
   * Generate unique vehicle ID from URL or content
   */
  static generateVehicleId(vehicle) {
    if (vehicle.url) {
      const hash = crypto.createHash('md5').update(vehicle.url).digest('hex');
      return `mobile_de_${hash.substring(0, 12)}`;
    }
    
    const content = `${vehicle.make}_${vehicle.model}_${vehicle.price}_${vehicle.year}_${vehicle.mileage}`;
    const hash = crypto.createHash('md5').update(content).digest('hex');
    return `mobile_de_${hash.substring(0, 12)}`;
  }

  /**
   * Extract Mobile.de ID from URL
   */
  static extractMobileDeId(url) {
    if (!url) return null;
    
    const match = url.match(/\/(\d+)\.html?$/);
    return match ? match[1] : null;
  }

  /**
   * Sanitize and validate string inputs
   */
  static sanitizeString(input) {
    if (!input || typeof input !== 'string') return null;
    
    return input
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[<>]/g, '') // Remove angle brackets
      .substring(0, 255); // Limit length
  }

  /**
   * Normalize price values
   */
  static normalizePrice(price) {
    if (!price) return null;
    
    const numPrice = typeof price === 'string' ? 
      parseFloat(price.replace(/[^\d.,]/g, '').replace(',', '.')) : 
      parseFloat(price);
    
    if (isNaN(numPrice) || numPrice < 0 || numPrice > 10000000) return null;
    
    return Math.round(numPrice);
  }

  /**
   * Normalize year values
   */
  static normalizeYear(year) {
    if (!year) return null;
    
    const numYear = parseInt(year);
    const currentYear = new Date().getFullYear();
    
    if (isNaN(numYear) || numYear < 1900 || numYear > currentYear + 2) return null;
    
    return numYear;
  }

  /**
   * Normalize month values
   */
  static normalizeMonth(month) {
    if (!month) return null;
    
    const numMonth = parseInt(month);
    
    if (isNaN(numMonth) || numMonth < 1 || numMonth > 12) return null;
    
    return numMonth;
  }

  /**
   * Normalize mileage values
   */
  static normalizeMileage(mileage) {
    if (!mileage) return null;
    
    const numMileage = typeof mileage === 'string' ? 
      parseInt(mileage.replace(/[^\d]/g, '')) : 
      parseInt(mileage);
    
    if (isNaN(numMileage) || numMileage < 0 || numMileage > 2000000) return null;
    
    return numMileage;
  }

  /**
   * Normalize fuel type
   */
  static normalizeFuelType(fuel) {
    if (!fuel || typeof fuel !== 'string') return null;
    
    const fuelMap = {
      'benzin': 'Benzin',
      'petrol': 'Benzin',
      'gasoline': 'Benzin',
      'diesel': 'Diesel',
      'elektro': 'Elektro',
      'electric': 'Elektro',
      'hybrid': 'Hybrid',
      'gas': 'Gas',
      'lpg': 'Gas',
      'cng': 'Gas',
      'wasserstoff': 'Wasserstoff',
      'hydrogen': 'Wasserstoff'
    };
    
    const normalizedFuel = fuel.toLowerCase().trim();
    return fuelMap[normalizedFuel] || fuel.substring(0, 20);
  }

  /**
   * Normalize transmission type
   */
  static normalizeTransmission(transmission) {
    if (!transmission || typeof transmission !== 'string') return null;
    
    const transmissionMap = {
      'manuell': 'Manuell',
      'manual': 'Manuell',
      'schaltgetriebe': 'Manuell',
      'automatik': 'Automatik',
      'automatic': 'Automatik',
      'halbautomatik': 'Halbautomatik',
      'semi-automatic': 'Halbautomatik',
      'cvt': 'CVT'
    };
    
    const normalizedTransmission = transmission.toLowerCase().trim();
    return transmissionMap[normalizedTransmission] || transmission.substring(0, 20);
  }

  /**
   * Normalize power values
   */
  static normalizePower(power) {
    if (!power) return null;
    
    const numPower = typeof power === 'string' ? 
      parseInt(power.replace(/[^\d]/g, '')) : 
      parseInt(power);
    
    if (isNaN(numPower) || numPower < 10 || numPower > 2000) return null;
    
    return numPower;
  }

  /**
   * Normalize door count
   */
  static normalizeDoors(doors) {
    if (!doors) return null;
    
    const numDoors = parseInt(doors);
    
    if (isNaN(numDoors) || numDoors < 2 || numDoors > 8) return null;
    
    return numDoors;
  }

  /**
   * Normalize seat count
   */
  static normalizeSeats(seats) {
    if (!seats) return null;
    
    const numSeats = parseInt(seats);
    
    if (isNaN(numSeats) || numSeats < 1 || numSeats > 15) return null;
    
    return numSeats;
  }

  /**
   * Normalize vehicle category
   */
  static normalizeCategory(category) {
    if (!category || typeof category !== 'string') return null;
    
    const categoryMap = {
      'limousine': 'Limousine',
      'sedan': 'Limousine',
      'kombi': 'Kombi',
      'wagon': 'Kombi',
      'estate': 'Kombi',
      'suv': 'SUV',
      'geländewagen': 'SUV',
      'cabrio': 'Cabrio',
      'cabriolet': 'Cabrio',
      'convertible': 'Cabrio',
      'coupe': 'Coupe',
      'coupé': 'Coupe',
      'van': 'Van',
      'minivan': 'Van',
      'kleinwagen': 'Kleinwagen',
      'compact': 'Kleinwagen',
      'sportwagen': 'Sportwagen',
      'sports car': 'Sportwagen'
    };
    
    const normalizedCategory = category.toLowerCase().trim();
    return categoryMap[normalizedCategory] || category.substring(0, 30);
  }

  /**
   * Normalize condition
   */
  static normalizeCondition(condition) {
    if (!condition || typeof condition !== 'string') return null;
    
    const conditionMap = {
      'neu': 'Neu',
      'new': 'Neu',
      'gebraucht': 'Gebraucht',
      'used': 'Gebraucht',
      'vorführfahrzeug': 'Vorführfahrzeug',
      'demo': 'Vorführfahrzeug',
      'demonstration': 'Vorführfahrzeug'
    };
    
    const normalizedCondition = condition.toLowerCase().trim();
    return conditionMap[normalizedCondition] || condition.substring(0, 20);
  }

  /**
   * Normalize seller type
   */
  static normalizeSellerType(sellerType) {
    if (!sellerType || typeof sellerType !== 'string') return null;
    
    const sellerMap = {
      'händler': 'dealer',
      'dealer': 'dealer',
      'gewerblich': 'dealer',
      'commercial': 'dealer',
      'privat': 'private',
      'private': 'private',
      'privatperson': 'private',
      'individual': 'private'
    };
    
    const normalizedSeller = sellerType.toLowerCase().trim();
    return sellerMap[normalizedSeller] || 'unknown';
  }

  /**
   * Normalize zipcode
   */
  static normalizeZipcode(zipcode) {
    if (!zipcode) return null;
    
    const cleanZip = zipcode.toString().replace(/[^\d]/g, '');
    
    if (cleanZip.length === 5 && /^\d{5}$/.test(cleanZip)) {
      return cleanZip;
    }
    
    return null;
  }

  /**
   * Normalize image URLs
   */
  static normalizeImages(images) {
    if (!Array.isArray(images)) return [];
    
    return images
      .filter(img => img && typeof img === 'string')
      .map(img => {
        // Convert relative URLs to absolute
        if (img.startsWith('/')) {
          return `https://www.mobile.de${img}`;
        }
        return img;
      })
      .filter(img => this.isValidImageUrl(img))
      .slice(0, 20); // Limit to 20 images
  }

  /**
   * Validate image URL
   */
  static isValidImageUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && 
             (parsed.hostname.includes('mobile.de') || parsed.hostname.includes('auto-bild.de'));
    } catch {
      return false;
    }
  }

  /**
   * Normalize features array
   */
  static normalizeFeatures(features) {
    if (!Array.isArray(features)) return [];
    
    return features
      .filter(feature => feature && typeof feature === 'string')
      .map(feature => this.sanitizeString(feature))
      .filter(feature => feature && feature.length > 2)
      .slice(0, 50); // Limit to 50 features
  }

  /**
   * Calculate vehicle age in years
   */
  static calculateVehicleAge(year, month) {
    if (!year) return null;
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    let age = currentYear - year;
    
    if (month && currentMonth < month) {
      age -= 1;
    }
    
    return Math.max(0, age);
  }

  /**
   * Calculate price per year of age
   */
  static calculatePricePerYear(price, ageInYears) {
    if (!price || !ageInYears || ageInYears === 0) return null;
    
    return Math.round(price / ageInYears);
  }

  /**
   * Generate search keywords for indexing
   */
  static generateSearchKeywords(vehicle) {
    const keywords = [];
    
    if (vehicle.make) keywords.push(vehicle.make.toLowerCase());
    if (vehicle.model) keywords.push(vehicle.model.toLowerCase());
    if (vehicle.category) keywords.push(vehicle.category.toLowerCase());
    if (vehicle.fuel) keywords.push(vehicle.fuel.toLowerCase());
    if (vehicle.transmission) keywords.push(vehicle.transmission.toLowerCase());
    if (vehicle.color) keywords.push(vehicle.color.toLowerCase());
    
    // Add feature keywords
    if (vehicle.features) {
      vehicle.features.forEach(feature => {
        if (feature.length > 3) {
          keywords.push(feature.toLowerCase());
        }
      });
    }
    
    return [...new Set(keywords)]; // Remove duplicates
  }
}

/**
 * Search parameter validation utilities
 */
class SearchParameterValidator {
  /**
   * Validate and normalize search parameters
   */
  static validateSearchParams(params) {
    const errors = [];
    const normalized = {};
    
    // Validate make
    if (params.make) {
      if (typeof params.make !== 'string' || params.make.length < 2) {
        errors.push('Make must be a string with at least 2 characters');
      } else {
        normalized.make = params.make.trim().substring(0, 50);
      }
    }
    
    // Validate model
    if (params.model) {
      if (typeof params.model !== 'string') {
        errors.push('Model must be a string');
      } else {
        normalized.model = params.model.trim().substring(0, 100);
      }
    }
    
    // Validate price range
    if (params.priceFrom !== undefined) {
      const priceFrom = parseInt(params.priceFrom);
      if (isNaN(priceFrom) || priceFrom < 0 || priceFrom > 10000000) {
        errors.push('Price from must be a valid number between 0 and 10,000,000');
      } else {
        normalized.priceFrom = priceFrom;
      }
    }
    
    if (params.priceTo !== undefined) {
      const priceTo = parseInt(params.priceTo);
      if (isNaN(priceTo) || priceTo < 0 || priceTo > 10000000) {
        errors.push('Price to must be a valid number between 0 and 10,000,000');
      } else {
        normalized.priceTo = priceTo;
      }
    }
    
    // Validate price range logic
    if (normalized.priceFrom && normalized.priceTo && normalized.priceFrom > normalized.priceTo) {
      errors.push('Price from cannot be greater than price to');
    }
    
    // Validate year range
    const currentYear = new Date().getFullYear();
    
    if (params.yearFrom !== undefined) {
      const yearFrom = parseInt(params.yearFrom);
      if (isNaN(yearFrom) || yearFrom < 1950 || yearFrom > currentYear + 1) {
        errors.push(`Year from must be between 1950 and ${currentYear + 1}`);
      } else {
        normalized.yearFrom = yearFrom;
      }
    }
    
    if (params.yearTo !== undefined) {
      const yearTo = parseInt(params.yearTo);
      if (isNaN(yearTo) || yearTo < 1950 || yearTo > currentYear + 1) {
        errors.push(`Year to must be between 1950 and ${currentYear + 1}`);
      } else {
        normalized.yearTo = yearTo;
      }
    }
    
    // Validate year range logic
    if (normalized.yearFrom && normalized.yearTo && normalized.yearFrom > normalized.yearTo) {
      errors.push('Year from cannot be greater than year to');
    }
    
    // Validate mileage
    if (params.mileageFrom !== undefined) {
      const mileageFrom = parseInt(params.mileageFrom);
      if (isNaN(mileageFrom) || mileageFrom < 0 || mileageFrom > 2000000) {
        errors.push('Mileage from must be between 0 and 2,000,000');
      } else {
        normalized.mileageFrom = mileageFrom;
      }
    }
    
    if (params.mileageTo !== undefined) {
      const mileageTo = parseInt(params.mileageTo);
      if (isNaN(mileageTo) || mileageTo < 0 || mileageTo > 2000000) {
        errors.push('Mileage to must be between 0 and 2,000,000');
      } else {
        normalized.mileageTo = mileageTo;
      }
    }
    
    // Validate zipcode
    if (params.zipcode) {
      if (!/^\d{5}$/.test(params.zipcode)) {
        errors.push('Zipcode must be exactly 5 digits');
      } else {
        normalized.zipcode = params.zipcode;
      }
    }
    
    // Validate radius
    if (params.radius !== undefined) {
      const radius = parseInt(params.radius);
      if (isNaN(radius) || radius < 5 || radius > 200) {
        errors.push('Radius must be between 5 and 200 km');
      } else {
        normalized.radius = radius;
      }
    }
    
    // Validate categorical parameters
    const validFuelTypes = ['Benzin', 'Diesel', 'Elektro', 'Hybrid', 'Gas'];
    if (params.fuel && !validFuelTypes.includes(params.fuel)) {
      errors.push(`Fuel type must be one of: ${validFuelTypes.join(', ')}`);
    } else if (params.fuel) {
      normalized.fuel = params.fuel;
    }
    
    const validTransmissions = ['Manuell', 'Automatik', 'Halbautomatik'];
    if (params.transmission && !validTransmissions.includes(params.transmission)) {
      errors.push(`Transmission must be one of: ${validTransmissions.join(', ')}`);
    } else if (params.transmission) {
      normalized.transmission = params.transmission;
    }
    
    const validConditions = ['Neu', 'Gebraucht', 'Vorführfahrzeug'];
    if (params.condition && !validConditions.includes(params.condition)) {
      errors.push(`Condition must be one of: ${validConditions.join(', ')}`);
    } else if (params.condition) {
      normalized.condition = params.condition;
    }
    
    const validSellerTypes = ['private', 'dealer'];
    if (params.sellerType && !validSellerTypes.includes(params.sellerType)) {
      errors.push(`Seller type must be one of: ${validSellerTypes.join(', ')}`);
    } else if (params.sellerType) {
      normalized.sellerType = params.sellerType;
    }
    
    return { errors, normalized };
  }
}

/**
 * Performance monitoring utilities
 */
class PerformanceMonitor {
  /**
   * Measure execution time of async function
   */
  static async measureAsync(name, fn) {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      logger.info(`Performance: ${name} completed in ${duration}ms`);
      return { result, duration };
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`Performance: ${name} failed after ${duration}ms`, error);
      throw error;
    }
  }
  
  /**
   * Create a performance timer
   */
  static createTimer(name) {
    const start = Date.now();
    return {
      stop: () => {
        const duration = Date.now() - start;
        logger.info(`Timer: ${name} - ${duration}ms`);
        return duration;
      }
    };
  }
}

/**
 * Data deduplication utilities
 */
class DeduplicationHelper {
  /**
   * Generate content hash for vehicle
   */
  static generateVehicleHash(vehicle) {
    const content = [
      vehicle.make,
      vehicle.model,
      vehicle.year,
      vehicle.mileage,
      vehicle.price,
      vehicle.fuel,
      vehicle.transmission
    ].filter(x => x !== null && x !== undefined).join('|');
    
    return crypto.createHash('md5').update(content).digest('hex');
  }
  
  /**
   * Check if two vehicles are duplicates
   */
  static areVehiclesDuplicate(vehicle1, vehicle2) {
    // Same URL
    if (vehicle1.url && vehicle2.url && vehicle1.url === vehicle2.url) {
      return true;
    }
    
    // Same hash
    const hash1 = this.generateVehicleHash(vehicle1);
    const hash2 = this.generateVehicleHash(vehicle2);
    
    if (hash1 === hash2) {
      return true;
    }
    
    // Similar attributes (fuzzy matching)
    const similarity = this.calculateVehicleSimilarity(vehicle1, vehicle2);
    return similarity > 0.9;
  }
  
  /**
   * Calculate similarity score between two vehicles
   */
  static calculateVehicleSimilarity(vehicle1, vehicle2) {
    let matches = 0;
    let comparisons = 0;
    
    const compareField = (field) => {
      if (vehicle1[field] && vehicle2[field]) {
        comparisons++;
        if (vehicle1[field] === vehicle2[field]) {
          matches++;
        }
      }
    };
    
    compareField('make');
    compareField('model');
    compareField('year');
    compareField('fuel');
    compareField('transmission');
    
    // Price similarity (within 5%)
    if (vehicle1.price && vehicle2.price) {
      comparisons++;
      const priceDiff = Math.abs(vehicle1.price - vehicle2.price);
      const avgPrice = (vehicle1.price + vehicle2.price) / 2;
      if (priceDiff / avgPrice < 0.05) {
        matches++;
      }
    }
    
    // Mileage similarity (within 10%)
    if (vehicle1.mileage && vehicle2.mileage) {
      comparisons++;
      const mileageDiff = Math.abs(vehicle1.mileage - vehicle2.mileage);
      const avgMileage = (vehicle1.mileage + vehicle2.mileage) / 2;
      if (avgMileage > 0 && mileageDiff / avgMileage < 0.1) {
        matches++;
      }
    }
    
    return comparisons > 0 ? matches / comparisons : 0;
  }
}

module.exports = {
  VehicleDataProcessor,
  SearchParameterValidator,
  PerformanceMonitor,
  DeduplicationHelper
};