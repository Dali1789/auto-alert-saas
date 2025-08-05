-- Mobile.de Original Filter Categories
-- Update database schema with real Mobile.de categories

-- Add Mobile.de specific enum types
CREATE TYPE mobile_de_vehicle_class AS ENUM (
    'Car',
    'Motorbike', 
    'Motorhome',
    'TruckOver7500',
    'TruckUpTo7500',
    'Trailer',
    'SemiTrailer',
    'Bus',
    'AgriculturalVehicle',
    'ConstructionMachine',
    'ForkliftTruck',
    'EBike'
);

CREATE TYPE mobile_de_car_category AS ENUM (
    'Limousine',
    'Kleinwagen',
    'Kombi',
    'Cabrio',
    'Coupe',
    'SUV',
    'Gelaendewagen',
    'Sportwagen',
    'Van',
    'Pickup',
    'Andere'
);

CREATE TYPE mobile_de_fuel_type AS ENUM (
    'PETROL',
    'DIESEL', 
    'ELECTRIC',
    'HYBRID',
    'HYBRID_PETROL',
    'HYBRID_DIESEL',
    'LPG',
    'CNG',
    'HYDROGEN',
    'ETHANOL',
    'OTHER'
);

CREATE TYPE mobile_de_gearbox AS ENUM (
    'MANUAL_GEAR',
    'AUTOMATIC_GEAR',
    'SEMIAUTOMATIC_GEAR'
);

CREATE TYPE mobile_de_condition AS ENUM (
    'NEW',
    'USED',
    'DEMONSTRATION',
    'PRE_REGISTERED'
);

CREATE TYPE mobile_de_seller_type AS ENUM (
    'DEALER',
    'FOR_SALE_BY_OWNER'
);

-- Update searches table with Mobile.de specific filters
ALTER TABLE public.auto_alert_searches 
ADD COLUMN IF NOT EXISTS vehicle_class mobile_de_vehicle_class DEFAULT 'Car',
ADD COLUMN IF NOT EXISTS category mobile_de_car_category,
ADD COLUMN IF NOT EXISTS condition mobile_de_condition,
ADD COLUMN IF NOT EXISTS gearbox mobile_de_gearbox,
ADD COLUMN IF NOT EXISTS fuel mobile_de_fuel_type,
ADD COLUMN IF NOT EXISTS seller_type mobile_de_seller_type,
ADD COLUMN IF NOT EXISTS power_min INTEGER, -- kW
ADD COLUMN IF NOT EXISTS power_max INTEGER, -- kW
ADD COLUMN IF NOT EXISTS doors INTEGER, -- 2/3, 4/5, etc.
ADD COLUMN IF NOT EXISTS seats_min INTEGER,
ADD COLUMN IF NOT EXISTS seats_max INTEGER,
ADD COLUMN IF NOT EXISTS first_registration_from DATE,
ADD COLUMN IF NOT EXISTS first_registration_to DATE,
ADD COLUMN IF NOT EXISTS zipcode VARCHAR(5), -- German postal code
ADD COLUMN IF NOT EXISTS radius INTEGER DEFAULT 50, -- km
ADD COLUMN IF NOT EXISTS exterior_color TEXT[],
ADD COLUMN IF NOT EXISTS features TEXT[], -- Array of Mobile.de features
ADD COLUMN IF NOT EXISTS exclude_export BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS only_with_images BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS max_owners INTEGER;

-- Update the fuel_types column to use the new enum (migrate existing data)
ALTER TABLE public.auto_alert_searches DROP COLUMN IF EXISTS fuel_types;

-- Add Mobile.de specific features enum
CREATE TYPE mobile_de_features AS ENUM (
    'ABS',
    'AIRBAG',
    'AIR_CONDITIONING',
    'AUTOMATIC_CLIMATISATION', 
    'MANUAL_CLIMATISATION',
    'ALLOY_WHEELS',
    'BLUETOOTH',
    'CENTRAL_LOCKING',
    'CRUISE_CONTROL',
    'ELECTRIC_WINDOWS',
    'ESP',
    'FOG_LIGHTS',
    'HEATED_SEATS',
    'LEATHER_SEATS',
    'NAVIGATION',
    'PARKING_SENSORS',
    'PARKING_CAMERA',
    'POWER_STEERING',
    'RADIO',
    'CD_PLAYER',
    'SUNROOF',
    'TRACTION_CONTROL',
    'XENON_LIGHTS',
    'LED_LIGHTS',
    'KEYLESS_GO',
    'LANE_ASSIST',
    'BLIND_SPOT',
    'ADAPTIVE_CRUISE_CONTROL',
    'EMERGENCY_BRAKE',
    'TIRE_PRESSURE',
    'ISOFIX',
    'HEATED_MIRRORS',
    'RAIN_SENSOR',
    'LIGHT_SENSOR',
    'START_STOP',
    'SPORT_SUSPENSION',
    'SPORT_SEATS',
    'MULTIFUNCTIONAL_STEERING',
    'VOICE_CONTROL',
    'WIRELESS_CHARGING',
    'HEAD_UP_DISPLAY',
    'MASSAGE_SEATS',
    'VENTILATED_SEATS',
    'PANORAMA_ROOF',
    'TRAILER_COUPLING',
    'ROOF_RAILS',
    'RUNNING_BOARDS',
    'PRIVACY_GLASS',
    'METALLIC_PAINT',
    'FULL_SERVICE_HISTORY',
    'NON_SMOKER',
    'GARAGE_KEPT',
    'TUNING',
    'ACCIDENT_FREE',
    'FIRST_HAND'
);

-- Add color options
CREATE TYPE mobile_de_colors AS ENUM (
    'BEIGE',
    'BLACK', 
    'BLUE',
    'BROWN',
    'GOLD',
    'GREY',
    'GREEN',
    'ORANGE',
    'PURPLE',
    'RED',
    'SILVER',
    'WHITE',
    'YELLOW',
    'OTHER'
);

-- Add sample data with real Mobile.de categories
INSERT INTO public.auto_alert_searches (
    user_id, 
    name, 
    make, 
    model_description,
    vehicle_class,
    category,
    price_min,
    price_max,
    year_min,
    year_max,
    fuel,
    gearbox,
    condition,
    seller_type,
    power_min,
    power_max,
    mileage_max,
    damage_allowed,
    zipcode,
    radius,
    features,
    exterior_color,
    active,
    notification_methods
)
SELECT 
    id,
    'BMW 740d Premium',
    'BMW',
    '740d',
    'Car'::mobile_de_vehicle_class,
    'Limousine'::mobile_de_car_category,
    20000,
    50000,
    2017,
    2023,
    'DIESEL'::mobile_de_fuel_type,
    'AUTOMATIC_GEAR'::mobile_de_gearbox,
    'USED'::mobile_de_condition,
    'DEALER'::mobile_de_seller_type,
    200, -- min 200kW
    400, -- max 400kW  
    150000,
    false,
    '10115', -- Berlin
    100,
    ARRAY['NAVIGATION', 'LEATHER_SEATS', 'XENON_LIGHTS']::TEXT[],
    ARRAY['BLACK', 'GREY']::TEXT[],
    true,
    ARRAY['email', 'voice']::TEXT[]
FROM public.auto_alert_user_profiles 
WHERE email = 'demo@autoalert.com'
ON CONFLICT DO NOTHING;

-- Add more realistic search examples
INSERT INTO public.auto_alert_searches (
    user_id, 
    name, 
    make, 
    model_description,
    vehicle_class,
    category,
    price_max,
    year_min,
    fuel,
    condition,
    seller_type,
    mileage_max,
    damage_allowed,
    zipcode,
    radius,
    features,
    active,
    notification_methods
)
SELECT 
    id,
    'Porsche 911 Cabrio Suche',
    'Porsche',
    '911',
    'Car'::mobile_de_vehicle_class,
    'Cabrio'::mobile_de_car_category,
    120000,
    2015,
    'PETROL'::mobile_de_fuel_type,
    'USED'::mobile_de_condition,
    'DEALER'::mobile_de_seller_type,
    80000,
    false,
    '80331', -- München
    50,
    ARRAY['SPORT_SEATS', 'SPORT_SUSPENSION', 'NAVIGATION']::TEXT[],
    true,
    ARRAY['email', 'voice']::TEXT[]
FROM public.auto_alert_user_profiles 
WHERE email = 'demo@autoalert.com'
ON CONFLICT DO NOTHING;

-- Golf GTI Suche für jüngere Zielgruppe
INSERT INTO public.auto_alert_searches (
    user_id, 
    name, 
    make, 
    model_description,
    vehicle_class,
    category,
    price_max,
    year_min,
    fuel,
    gearbox,
    condition,
    mileage_max,
    damage_allowed,
    zipcode,
    radius,
    features,
    active,
    notification_methods
)
SELECT 
    id,
    'VW Golf GTI Schnäppchen',
    'Volkswagen',
    'Golf GTI',
    'Car'::mobile_de_vehicle_class,
    'Kleinwagen'::mobile_de_car_category,
    25000,
    2018,
    'PETROL'::mobile_de_fuel_type,
    'MANUAL_GEAR'::mobile_de_gearbox,
    'USED'::mobile_de_condition,
    100000,
    true, -- auch Unfallfahrzeuge OK für Schnäppchen
    '22085', -- Hamburg  
    200,
    ARRAY['XENON_LIGHTS', 'SPORT_SEATS']::TEXT[],
    true,
    ARRAY['email', 'sms']::TEXT[]
FROM public.auto_alert_user_profiles 
WHERE email = 'test@autoalert.com'
ON CONFLICT DO NOTHING;