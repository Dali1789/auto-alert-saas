/**
 * MobileDEApiBuilder Unit Tests - London School TDD
 * Focus on API URL construction, parameter mapping, and data parsing contracts
 */

const MobileDEApiBuilder = require('../../../railway/notification-service/src/services/MobileDEApiBuilder');
const { TestDataBuilder } = require('../../fixtures/test-data');

describe('MobileDEApiBuilder', () => {
  let apiBuilder;

  beforeEach(() => {
    apiBuilder = new MobileDEApiBuilder();
  });

  describe('URL Construction', () => {
    describe('buildSearchUrl', () => {
      it('should construct basic search URL with required parameters', () => {
        // Arrange
        const searchParams = {
          make: 'BMW',
          model: '7er'
        };

        // Act
        const url = apiBuilder.buildSearchUrl(searchParams);

        // Assert
        expect(url).toContain('https://services.mobile.de/search-api/search');
        expect(url).toContain('country=DE');
        expect(url).toContain('page.size=100');
        expect(url).toContain('sort.field=creationTime');
        expect(url).toContain('sort.order=DESCENDING');
      });

      it('should include make classification when make is provided', () => {
        // Arrange
        const searchParams = { make: 'BMW' };

        // Act
        const url = apiBuilder.buildSearchUrl(searchParams);

        // Assert
        expect(url).toContain('classification=refdata%2Fclasses%2FCar%2Fmakes%2FBMW');
      });

      it('should include model in classification when both make and model are provided', () => {
        // Arrange
        const searchParams = {
          make: 'BMW',
          model: '7er'
        };

        // Act
        const url = apiBuilder.buildSearchUrl(searchParams);

        // Assert
        expect(url).toContain('classification=refdata%2Fclasses%2FCar%2Fmakes%2FBMW%2Fmodels%2F7ER');
      });

      it('should handle price range parameters correctly', () => {
        // Arrange
        const searchParams = {
          price_min: 15000,
          price_max: 35000
        };

        // Act
        const url = apiBuilder.buildSearchUrl(searchParams);

        // Assert
        expect(url).toContain('price.min=15000');
        expect(url).toContain('price.max=35000');
      });

      it('should convert year range to first registration date format', () => {
        // Arrange
        const searchParams = {
          year_min: 2018,
          year_max: 2022
        };

        // Act
        const url = apiBuilder.buildSearchUrl(searchParams);

        // Assert
        expect(url).toContain('firstRegistrationDate.min=2018-01');
        expect(url).toContain('firstRegistrationDate.max=2022-12');
      });

      it('should include all optional parameters when provided', () => {
        // Arrange
        const searchParams = {
          make: 'BMW',
          model: '7er',
          category: 'Limousine',
          price_min: 20000,
          price_max: 40000,
          year_min: 2015,
          year_max: 2023,
          mileage_max: 100000,
          power_min: 200,
          power_max: 400,
          fuel: 'DIESEL',
          gearbox: 'AUTOMATIC',
          condition: 'USED',
          seller_type: 'DEALER',
          damage_allowed: false,
          zipcode: '80331',
          radius: 50,
          features: ['NAVIGATION', 'LEATHER'],
          exclude_export: true,
          only_with_images: true,
          model_description: '740d'
        };

        // Act
        const url = apiBuilder.buildSearchUrl(searchParams);

        // Assert
        expect(url).toContain('category=Limousine');
        expect(url).toContain('mileage.max=100000');
        expect(url).toContain('power.min=200');
        expect(url).toContain('power.max=400');
        expect(url).toContain('fuel=DIESEL');
        expect(url).toContain('gearbox=AUTOMATIC');
        expect(url).toContain('condition=USED');
        expect(url).toContain('sellerType=DEALER');
        expect(url).toContain('damageUnrepaired=0');
        expect(url).toContain('ambit.zipcode=80331');
        expect(url).toContain('ambit.radius=50');
        expect(url).toContain('feature=NAVIGATION%2CLEATHER');
        expect(url).toContain('excludeFeature=EXPORT');
        expect(url).toContain('imageCount.min=1');
        expect(url).toContain('modelDescription=740d');
      });

      it('should handle damage_allowed parameter correctly', () => {
        // Arrange - Test both true and false values
        const allowDamage = { damage_allowed: true };
        const noDamage = { damage_allowed: false };

        // Act
        const urlWithDamage = apiBuilder.buildSearchUrl(allowDamage);
        const urlWithoutDamage = apiBuilder.buildSearchUrl(noDamage);

        // Assert
        expect(urlWithDamage).toContain('damageUnrepaired=1');
        expect(urlWithoutDamage).toContain('damageUnrepaired=0');
      });

      it('should ignore undefined or null parameters', () => {
        // Arrange
        const searchParams = {
          make: 'BMW',
          model: null,
          price_min: undefined,
          price_max: 30000
        };

        // Act
        const url = apiBuilder.buildSearchUrl(searchParams);

        // Assert
        expect(url).toContain('price.max=30000');
        expect(url).not.toContain('price.min');
        expect(url).not.toContain('null');
        expect(url).not.toContain('undefined');
      });
    });
  });

  describe('Model ID Resolution', () => {
    describe('getModelId', () => {
      it('should return correct BMW model IDs', () => {
        // Arrange & Act & Assert
        const testCases = [
          { make: 'BMW', model: '1er', expected: '9' },
          { make: 'BMW', model: '3er', expected: '35' },
          { make: 'BMW', model: '5er', expected: '36' },
          { make: 'BMW', model: '7er', expected: '35' },
          { make: 'BMW', model: 'X5', expected: '78' },
          { make: 'BMW', model: 'i8', expected: '98' }
        ];

        testCases.forEach(({ make, model, expected }) => {
          expect(apiBuilder.getModelId(make, model)).toBe(expected);
        });
      });

      it('should return correct Porsche model IDs', () => {
        // Arrange & Act & Assert
        const testCases = [
          { make: 'PORSCHE', model: '911', expected: '3' },
          { make: 'PORSCHE', model: 'Cayenne', expected: '6' },
          { make: 'PORSCHE', model: 'Panamera', expected: '11' },
          { make: 'PORSCHE', model: 'Taycan', expected: '15' }
        ];

        testCases.forEach(({ make, model, expected }) => {
          expect(apiBuilder.getModelId(make, model)).toBe(expected);
        });
      });

      it('should return null for unknown makes', () => {
        // Act & Assert
        expect(apiBuilder.getModelId('UNKNOWN_MAKE', 'SomeModel')).toBeNull();
      });

      it('should return null for unknown models within known makes', () => {
        // Act & Assert
        expect(apiBuilder.getModelId('BMW', 'UNKNOWN_MODEL')).toBeNull();
      });

      it('should handle case sensitivity correctly', () => {
        // Act & Assert
        expect(apiBuilder.getModelId('bmw', '3er')).toBeNull(); // lowercase should not match
        expect(apiBuilder.getModelId('BMW', '3er')).toBe('35'); // uppercase should match
      });
    });
  });

  describe('API Response Parsing', () => {
    describe('parseApiResponse', () => {
      it('should parse complete API response with all fields', () => {
        // Arrange
        const apiResponse = TestDataBuilder.apiResponse();

        // Act
        const parsed = apiBuilder.parseApiResponse(apiResponse);

        // Assert
        expect(parsed).toHaveLength(1);
        const vehicle = parsed[0];
        
        expect(vehicle.mobileAdId).toBe('12345');
        expect(vehicle.title).toBe('BMW 7er 740d xDrive');
        expect(vehicle.make).toBe('BMW');
        expect(vehicle.model).toBe('7er');
        expect(vehicle.modelDescription).toBe('740d xDrive');
        expect(vehicle.price).toBe(22500);
        expect(vehicle.currency).toBe('EUR');
        expect(vehicle.year).toBe(2018);
        expect(vehicle.month).toBe(8);
        expect(vehicle.mileage).toBe(89000);
        expect(vehicle.fuel).toBe('DIESEL');
        expect(vehicle.gearbox).toBe('AUTOMATIC');
        expect(vehicle.power).toBe(235);
        expect(vehicle.powerHP).toBe(320); // Converted from kW
      });

      it('should handle missing or null price data gracefully', () => {
        // Arrange
        const apiResponse = {
          ads: [
            {
              mobileAdId: '12345',
              make: 'BMW',
              model: '3er',
              price: null // No price data
            }
          ]
        };

        // Act
        const parsed = apiBuilder.parseApiResponse(apiResponse);

        // Assert
        expect(parsed[0].price).toBe(0);
        expect(parsed[0].currency).toBe('EUR'); // Default
      });

      it('should calculate HP from kW power correctly', () => {
        // Arrange
        const apiResponse = {
          ads: [
            {
              mobileAdId: '12345',
              make: 'BMW',
              model: '3er',
              power: 100 // 100 kW
            }
          ]
        };

        // Act
        const parsed = apiBuilder.parseApiResponse(apiResponse);

        // Assert
        expect(parsed[0].power).toBe(100);
        expect(parsed[0].powerHP).toBe(136); // 100 * 1.36 rounded
      });

      it('should parse first registration date correctly', () => {
        // Arrange
        const testCases = [
          { input: '201808', expectedYear: 2018, expectedMonth: 8 },
          { input: '202001', expectedYear: 2020, expectedMonth: 1 },
          { input: '202212', expectedYear: 2022, expectedMonth: 12 }
        ];

        testCases.forEach(({ input, expectedYear, expectedMonth }) => {
          const apiResponse = {
            ads: [
              {
                mobileAdId: '12345',
                make: 'BMW',
                model: '3er',
                firstRegistration: input
              }
            ]
          };

          // Act
          const parsed = apiBuilder.parseApiResponse(apiResponse);

          // Assert
          expect(parsed[0].year).toBe(expectedYear);
          expect(parsed[0].month).toBe(expectedMonth);
        });
      });

      it('should handle empty or invalid API response', () => {
        // Arrange & Act & Assert
        const testCases = [
          { input: null, expected: [] },
          { input: {}, expected: [] },
          { input: { ads: null }, expected: [] },
          { input: { ads: 'invalid' }, expected: [] },
          { input: { ads: [] }, expected: [] }
        ];

        testCases.forEach(({ input, expected }) => {
          expect(apiBuilder.parseApiResponse(input)).toEqual(expected);
        });
      });

      it('should extract seller information correctly', () => {
        // Arrange
        const apiResponse = {
          ads: [
            {
              mobileAdId: '12345',
              make: 'BMW',
              model: '3er',
              seller: {
                type: 'DEALER',
                address: {
                  city: 'München',
                  zipcode: '80331'
                },
                companyName: 'BMW Autohaus München',
                commercial: true
              }
            }
          ]
        };

        // Act
        const parsed = apiBuilder.parseApiResponse(apiResponse);

        // Assert
        const vehicle = parsed[0];
        expect(vehicle.sellerType).toBe('DEALER');
        expect(vehicle.sellerCity).toBe('München');
        expect(vehicle.sellerZipcode).toBe('80331');
        expect(vehicle.sellerCompany).toBe('BMW Autohaus München');
        expect(vehicle.sellerCommercial).toBe(true);
      });

      it('should handle arrays for features and images', () => {
        // Arrange
        const apiResponse = {
          ads: [
            {
              mobileAdId: '12345',
              make: 'BMW',
              model: '3er',
              features: ['AIR_CONDITIONING', 'NAVIGATION', 'LEATHER_SEATS'],
              images: ['https://img.mobile.de/1.jpg', 'https://img.mobile.de/2.jpg']
            }
          ]
        };

        // Act
        const parsed = apiBuilder.parseApiResponse(apiResponse);

        // Assert
        const vehicle = parsed[0];
        expect(vehicle.features).toEqual(['AIR_CONDITIONING', 'NAVIGATION', 'LEATHER_SEATS']);
        expect(vehicle.images).toEqual(['https://img.mobile.de/1.jpg', 'https://img.mobile.de/2.jpg']);
      });
    });
  });

  describe('Search Parameter Conversion', () => {
    describe('buildSearchParamsFromDB', () => {
      it('should convert database search object to API parameters', () => {
        // Arrange
        const dbSearch = TestDataBuilder.search({
          make: 'BMW',
          model: '7er',
          model_description: '740d',
          price_min: 20000,
          price_max: 40000,
          year_min: 2015,
          year_max: 2023,
          features: ['NAVIGATION', 'LEATHER'],
          exclude_export: true
        });

        // Act
        const apiParams = apiBuilder.buildSearchParamsFromDB(dbSearch);

        // Assert
        expect(apiParams.make).toBe('BMW');
        expect(apiParams.model).toBe('7er');
        expect(apiParams.model_description).toBe('740d');
        expect(apiParams.price_min).toBe(20000);
        expect(apiParams.price_max).toBe(40000);
        expect(apiParams.year_min).toBe(2015);
        expect(apiParams.year_max).toBe(2023);
        expect(apiParams.features).toEqual(['NAVIGATION', 'LEATHER']);
        expect(apiParams.exclude_export).toBe(true);
      });

      it('should handle null values in database search object', () => {
        // Arrange
        const dbSearch = {
          make: 'BMW',
          model: null,
          price_min: null,
          price_max: 30000,
          features: null
        };

        // Act
        const apiParams = apiBuilder.buildSearchParamsFromDB(dbSearch);

        // Assert
        expect(apiParams.make).toBe('BMW');
        expect(apiParams.model).toBeNull();
        expect(apiParams.price_min).toBeNull();
        expect(apiParams.price_max).toBe(30000);
        expect(apiParams.features).toBeNull();
      });
    });

    describe('getSearchDescription', () => {
      it('should generate human-readable search descriptions', () => {
        // Arrange & Act & Assert
        const testCases = [
          {
            params: { make: 'BMW' },
            expected: 'BMW'
          },
          {
            params: { make: 'BMW', model: '7er' },
            expected: 'BMW 7er'
          },
          {
            params: { make: 'BMW', model_description: '740d' },
            expected: 'BMW 740d'
          },
          {
            params: { make: 'BMW', model: '7er', category: 'Limousine' },
            expected: 'BMW 7er (Limousine)'
          },
          {
            params: { make: 'BMW', year_min: 2018, year_max: 2022 },
            expected: 'BMW ab 2018 bis 2022'
          },
          {
            params: { make: 'BMW', price_max: 30000 },
            expected: 'BMW bis 30.000€'
          },
          {
            params: { make: 'BMW', fuel: 'DIESEL' },
            expected: 'BMW Diesel'
          }
        ];

        testCases.forEach(({ params, expected }) => {
          expect(apiBuilder.getSearchDescription(params)).toBe(expected);
        });
      });

      it('should handle empty search parameters', () => {
        // Act
        const description = apiBuilder.getSearchDescription({});

        // Assert
        expect(description).toBe('Fahrzeugsuche');
      });

      it('should format fuel types with German names', () => {
        // Arrange & Act & Assert
        const fuelMappings = [
          { fuel: 'DIESEL', expected: 'Diesel' },
          { fuel: 'PETROL', expected: 'Benzin' },
          { fuel: 'ELECTRIC', expected: 'Elektro' },
          { fuel: 'HYBRID', expected: 'Hybrid' }
        ];

        fuelMappings.forEach(({ fuel, expected }) => {
          const params = { make: 'BMW', fuel };
          expect(apiBuilder.getSearchDescription(params)).toBe(`BMW ${expected}`);
        });
      });

      it('should handle current year in year range', () => {
        // Arrange
        const currentYear = new Date().getFullYear();
        const params = {
          make: 'BMW',
          year_min: 2018,
          year_max: currentYear
        };

        // Act
        const description = apiBuilder.getSearchDescription(params);

        // Assert
        expect(description).toBe('BMW ab 2018'); // Should not include "bis {current year}"
      });
    });
  });

  describe('Contract Verification', () => {
    it('should maintain expected public interface', () => {
      // Arrange
      const expectedMethods = [
        'buildSearchUrl',
        'getModelId',
        'parseApiResponse',
        'buildSearchParamsFromDB',
        'getSearchDescription'
      ];

      // Assert
      expectedMethods.forEach(method => {
        expect(typeof apiBuilder[method]).toBe('function');
      });
    });

    it('should have correctly configured make and model mappings', () => {
      // Assert
      expect(apiBuilder.makeIds).toBeDefined();
      expect(apiBuilder.bmwModels).toBeDefined();
      expect(apiBuilder.porscheModels).toBeDefined();

      // Verify some key mappings exist
      expect(apiBuilder.makeIds.BMW).toBe('3500');
      expect(apiBuilder.makeIds.Mercedes).toBe('17200');
      expect(apiBuilder.bmwModels['3er']).toBe('35');
      expect(apiBuilder.porscheModels['911']).toBe('3');
    });

    it('should maintain consistent base URL configuration', () => {
      // Assert
      expect(apiBuilder.baseUrl).toBe('https://services.mobile.de/search-api/search');
    });
  });
});