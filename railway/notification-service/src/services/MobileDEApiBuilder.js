/**
 * Mobile.de API Integration with authentic categories
 * Builds proper Mobile.de search URLs with real parameters
 */

class MobileDEApiBuilder {
  constructor() {
    this.baseUrl = 'https://services.mobile.de/search-api/search';
    
    // Mobile.de Make IDs (real values)
    this.makeIds = {
      'BMW': '3500',
      'Mercedes': '17200', 
      'Audi': '1900',
      'Volkswagen': '25200',
      'Porsche': '20000',
      'Opel': '18700',
      'Ford': '9000',
      'Renault': '21500',
      'Peugeot': '19300',
      'Toyota': '24200',
      'Nissan': '18200',
      'Hyundai': '11900',
      'Kia': '13700',
      'Skoda': '22600',
      'Seat': '22000',
      'Fiat': '8800',
      'Alfa Romeo': '1200',
      'Volvo': '25100',
      'Mazda': '16900',
      'Honda': '11400',
      'Mitsubishi': '17900',
      'Subaru': '23200',
      'Suzuki': '23400',
      'Dacia': '6400',
      'Smart': '22200',
      'Mini': '14800',
      'Jaguar': '12800',
      'Land Rover': '14900',
      'Bentley': '2800',
      'Rolls Royce': '21800',
      'Ferrari': '8600',
      'Lamborghini': '14600',
      'Maserati': '16800',
      'Tesla': '23800'
    };

    // BMW Model IDs (examples)
    this.bmwModels = {
      '1er': '9',
      '2er': '101', 
      '3er': '35',
      '4er': '102',
      '5er': '36',
      '6er': '37',
      '7er': '35', // 740d ist Teil der 7er Serie
      '8er': '103',
      'X1': '76',
      'X2': '104',
      'X3': '77',
      'X4': '105',
      'X5': '78',
      'X6': '79',
      'X7': '106',
      'Z3': '80',
      'Z4': '81',
      'Z8': '82',
      'i3': '97',
      'i4': '107',
      'i8': '98',
      'iX': '108'
    };

    // Porsche Models
    this.porscheModels = {
      '911': '3',
      '718': '14',
      'Cayenne': '6',
      'Macan': '13',
      'Panamera': '11',
      'Taycan': '15'
    };
  }

  /**
   * Build Mobile.de search URL from search parameters
   */
  buildSearchUrl(searchParams) {
    const params = new URLSearchParams();

    // Basic parameters
    params.set('country', 'DE');
    params.set('page.size', '100');
    params.set('sort.field', 'creationTime');
    params.set('sort.order', 'DESCENDING');

    // Vehicle class and classification
    if (searchParams.make) {
      const makeId = this.makeIds[searchParams.make];
      if (makeId) {
        let classification = `refdata/classes/Car/makes/${searchParams.make.toUpperCase()}`;
        
        // Add model if specified
        if (searchParams.model) {
          const modelId = this.getModelId(searchParams.make, searchParams.model);
          if (modelId) {
            classification += `/models/${searchParams.model.toUpperCase()}`;
          }
        }
        
        params.set('classification', classification);
      }
    }

    // Category (Limousine, Cabrio, etc.)
    if (searchParams.category) {
      params.set('category', searchParams.category);
    }

    // Price range
    if (searchParams.price_min) {
      params.set('price.min', searchParams.price_min.toString());
    }
    if (searchParams.price_max) {
      params.set('price.max', searchParams.price_max.toString());
    }

    // Year range (first registration)
    if (searchParams.year_min) {
      params.set('firstRegistrationDate.min', `${searchParams.year_min}-01`);
    }
    if (searchParams.year_max) {
      params.set('firstRegistrationDate.max', `${searchParams.year_max}-12`);
    }

    // Mileage
    if (searchParams.mileage_max) {
      params.set('mileage.max', searchParams.mileage_max.toString());
    }

    // Power range (kW)
    if (searchParams.power_min) {
      params.set('power.min', searchParams.power_min.toString());
    }
    if (searchParams.power_max) {
      params.set('power.max', searchParams.power_max.toString());
    }

    // Fuel type
    if (searchParams.fuel) {
      params.set('fuel', searchParams.fuel);
    }

    // Gearbox
    if (searchParams.gearbox) {
      params.set('gearbox', searchParams.gearbox);
    }

    // Condition
    if (searchParams.condition) {
      params.set('condition', searchParams.condition);
    }

    // Seller type
    if (searchParams.seller_type) {
      params.set('sellerType', searchParams.seller_type);
    }

    // Damage filter
    if (searchParams.damage_allowed !== undefined) {
      params.set('damageUnrepaired', searchParams.damage_allowed ? '1' : '0');
    }

    // Regional search
    if (searchParams.zipcode) {
      params.set('ambit.zipcode', searchParams.zipcode);
      if (searchParams.radius) {
        params.set('ambit.radius', searchParams.radius.toString());
      }
    }

    // Features
    if (searchParams.features && searchParams.features.length > 0) {
      params.set('feature', searchParams.features.join(','));
    }

    // Exclude export vehicles
    if (searchParams.exclude_export) {
      params.set('excludeFeature', 'EXPORT');
    }

    // Images requirement
    if (searchParams.only_with_images) {
      params.set('imageCount.min', '1');
    }

    // Model description (for specific variants like "740d")
    if (searchParams.model_description) {
      params.set('modelDescription', searchParams.model_description);
    }

    return `${this.baseUrl}?${params.toString()}`;
  }

  /**
   * Get model ID for specific make/model combination
   */
  getModelId(make, model) {
    switch (make.toUpperCase()) {
      case 'BMW':
        return this.bmwModels[model] || null;
      case 'PORSCHE':
        return this.porscheModels[model] || null;
      default:
        return null;
    }
  }

  /**
   * Parse Mobile.de response and normalize data
   */
  parseApiResponse(apiResponse) {
    if (!apiResponse.ads || !Array.isArray(apiResponse.ads)) {
      return [];
    }

    return apiResponse.ads.map(ad => ({
      // Core vehicle data
      mobileAdId: ad.mobileAdId,
      title: `${ad.make} ${ad.model} ${ad.modelDescription || ''}`.trim(),
      make: ad.make,
      model: ad.model,
      modelDescription: ad.modelDescription,
      
      // Pricing
      price: parseFloat(ad.price?.consumerPriceGross) || 0,
      currency: ad.price?.currency || 'EUR',
      priceType: ad.price?.type,
      
      // Technical details
      year: ad.firstRegistration ? parseInt(ad.firstRegistration.substring(0, 4)) : null,
      month: ad.firstRegistration ? parseInt(ad.firstRegistration.substring(4, 6)) : null,
      mileage: ad.mileage || 0,
      fuel: ad.fuel,
      gearbox: ad.gearbox,
      power: ad.power, // kW
      powerHP: ad.power ? Math.round(ad.power * 1.36) : null, // Convert kW to HP
      
      // Condition & damage
      condition: ad.condition,
      damageUnrepaired: ad.damageUnrepaired || false,
      accidentDamaged: ad.accidentDamaged || false,
      roadworthy: ad.roadworthy,
      
      // Vehicle details
      category: ad.category,
      doors: ad.doorCount,
      seats: ad.numSeats,
      exteriorColor: ad.exteriorColor,
      interiorColor: ad.interiorColor,
      
      // Seller information
      sellerType: ad.seller?.type,
      sellerCity: ad.seller?.address?.city,
      sellerZipcode: ad.seller?.address?.zipcode,
      sellerCompany: ad.seller?.companyName,
      sellerCommercial: ad.seller?.commercial,
      
      // URLs and metadata
      detailUrl: ad.detailPageUrl,
      creationDate: ad.creationDate,
      modificationDate: ad.modificationDate,
      
      // Additional data
      features: ad.features || [],
      images: ad.images || [],
      description: ad.plainTextDescription
    }));
  }

  /**
   * Build search parameters from database search object
   */
  buildSearchParamsFromDB(dbSearch) {
    return {
      make: dbSearch.make,
      model: dbSearch.model,
      model_description: dbSearch.model_description,
      category: dbSearch.category,
      price_min: dbSearch.price_min,
      price_max: dbSearch.price_max,
      year_min: dbSearch.year_min,
      year_max: dbSearch.year_max,
      mileage_max: dbSearch.mileage_max,
      power_min: dbSearch.power_min,
      power_max: dbSearch.power_max,
      fuel: dbSearch.fuel,
      gearbox: dbSearch.gearbox,
      condition: dbSearch.condition,
      seller_type: dbSearch.seller_type,
      damage_allowed: dbSearch.damage_allowed,
      zipcode: dbSearch.zipcode,
      radius: dbSearch.radius,
      features: dbSearch.features,
      exclude_export: dbSearch.exclude_export,
      only_with_images: dbSearch.only_with_images
    };
  }

  /**
   * Get human-readable search description
   */
  getSearchDescription(searchParams) {
    let description = '';
    
    if (searchParams.make) {
      description += searchParams.make;
      if (searchParams.model_description) {
        description += ` ${searchParams.model_description}`;
      } else if (searchParams.model) {
        description += ` ${searchParams.model}`;
      }
    }
    
    if (searchParams.category) {
      description += ` (${searchParams.category})`;
    }
    
    if (searchParams.year_min || searchParams.year_max) {
      description += ` ab ${searchParams.year_min || 'Alle'}`;
      if (searchParams.year_max && searchParams.year_max !== new Date().getFullYear()) {
        description += ` bis ${searchParams.year_max}`;
      }
    }
    
    if (searchParams.price_max) {
      description += ` bis ${searchParams.price_max.toLocaleString('de-DE')}€`;
    }
    
    if (searchParams.fuel) {
      const fuelNames = {
        'DIESEL': 'Diesel',
        'PETROL': 'Benzin',
        'ELECTRIC': 'Elektro',
        'HYBRID': 'Hybrid'
      };
      description += ` ${fuelNames[searchParams.fuel] || searchParams.fuel}`;
    }
    
    return description || 'Fahrzeugsuche';
  }
}

module.exports = MobileDEApiBuilder;