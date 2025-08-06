-- Auto-Alert SaaS Database Schema
-- Complete isolated database for Railway PostgreSQL

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create schema for auto-alert
CREATE SCHEMA IF NOT EXISTS auto_alert;

-- Set search path
SET search_path TO auto_alert, public;

-- User profiles table
CREATE TABLE IF NOT EXISTS auto_alert_user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    subscription_type VARCHAR(50) DEFAULT 'free',
    preferences JSONB DEFAULT '{}'::jsonb
);

-- Search criteria table
CREATE TABLE IF NOT EXISTS auto_alert_search_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auto_alert_user_profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    min_price INTEGER,
    max_price INTEGER,
    min_year INTEGER,
    max_year INTEGER,
    max_mileage INTEGER,
    fuel_type VARCHAR(50),
    transmission VARCHAR(50),
    location_radius INTEGER DEFAULT 50,
    location_city VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    notification_types JSONB DEFAULT '["email", "phone"]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Found vehicles table
CREATE TABLE IF NOT EXISTS auto_alert_found_vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    search_criteria_id UUID REFERENCES auto_alert_search_criteria(id) ON DELETE CASCADE,
    external_id VARCHAR(255) NOT NULL,
    source_platform VARCHAR(50) NOT NULL, -- mobile.de, autoscout24.de
    title VARCHAR(500) NOT NULL,
    price INTEGER,
    year INTEGER,
    mileage INTEGER,
    fuel_type VARCHAR(50),
    transmission VARCHAR(50),
    location VARCHAR(255),
    description TEXT,
    images_urls JSONB DEFAULT '[]'::jsonb,
    url VARCHAR(1000) NOT NULL,
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_notified BOOLEAN DEFAULT false,
    notification_sent_at TIMESTAMP,
    vehicle_data JSONB DEFAULT '{}'::jsonb,
    UNIQUE(external_id, source_platform)
);

-- Notifications log table
CREATE TABLE IF NOT EXISTS auto_alert_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auto_alert_user_profiles(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES auto_alert_found_vehicles(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- email, sms, voice_call
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, delivered
    recipient VARCHAR(255) NOT NULL,
    message TEXT,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT,
    external_id VARCHAR(255), -- Retell AI call ID, Resend message ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON auto_alert_user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_search_criteria_user_id ON auto_alert_search_criteria(user_id);
CREATE INDEX IF NOT EXISTS idx_search_criteria_active ON auto_alert_search_criteria(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_found_vehicles_search_criteria ON auto_alert_found_vehicles(search_criteria_id);
CREATE INDEX IF NOT EXISTS idx_found_vehicles_source ON auto_alert_found_vehicles(source_platform);
CREATE INDEX IF NOT EXISTS idx_found_vehicles_external_id ON auto_alert_found_vehicles(external_id, source_platform);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON auto_alert_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON auto_alert_notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON auto_alert_notifications(notification_type);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON auto_alert_user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_search_criteria_updated_at BEFORE UPDATE ON auto_alert_search_criteria FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO auto_alert_user_profiles (email, name, phone) VALUES 
('demo@example.com', 'Demo User', '+49123456789')
ON CONFLICT (email) DO NOTHING;

-- Get the demo user ID for sample data
WITH demo_user AS (
    SELECT id FROM auto_alert_user_profiles WHERE email = 'demo@example.com'
)
INSERT INTO auto_alert_search_criteria (
    user_id, name, brand, model, min_price, max_price, min_year, max_year, 
    max_mileage, fuel_type, location_city
) 
SELECT 
    demo_user.id, 'BMW 3er Suche', 'BMW', '3er', 15000, 35000, 2018, 2023, 
    80000, 'Benzin', 'München'
FROM demo_user
ON CONFLICT DO NOTHING;

-- Create RLS (Row Level Security) policies
ALTER TABLE auto_alert_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_alert_search_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_alert_found_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_alert_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies (for future multi-tenancy)
CREATE POLICY "Users can view own profile" ON auto_alert_user_profiles
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can view own search criteria" ON auto_alert_search_criteria
    FOR SELECT USING (auth.uid()::text = user_id::text);

-- Grant permissions to application user
GRANT USAGE ON SCHEMA auto_alert TO autoalert_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auto_alert TO autoalert_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auto_alert TO autoalert_user;

-- Create database health check function
CREATE OR REPLACE FUNCTION health_check()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'status', 'healthy',
        'timestamp', NOW(),
        'database', 'autoalert',
        'tables', (
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'auto_alert'
        ),
        'users_count', (SELECT COUNT(*) FROM auto_alert_user_profiles),
        'active_searches', (SELECT COUNT(*) FROM auto_alert_search_criteria WHERE is_active = true)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;