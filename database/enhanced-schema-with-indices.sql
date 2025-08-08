-- Enhanced Auto Alert SaaS Database Schema with Performance Optimizations
-- This schema includes proper indexing for fast searches and efficient queries

-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS auto_alert;
SET search_path TO auto_alert;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- USER PROFILES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS auto_alert_user_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    preferences JSONB DEFAULT '{"notifications": ["email"]}'::jsonb,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for user profiles
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email ON auto_alert_user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON auto_alert_user_profiles(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON auto_alert_user_profiles(created_at);

-- ========================================
-- SUBSCRIPTIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS auto_alert_subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auto_alert_user_profiles(id) ON DELETE CASCADE,
    tier VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'basic', 'premium', 'enterprise')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'unpaid')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    payment_method_id VARCHAR(255),
    billing_address JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for subscriptions
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_active ON auto_alert_subscriptions(user_id) 
    WHERE status IN ('active', 'past_due');
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON auto_alert_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON auto_alert_subscriptions(current_period_end) 
    WHERE status = 'active';

-- ========================================
-- SEARCH CRITERIA TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS auto_alert_search_criteria (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auto_alert_user_profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    criteria JSONB NOT NULL,
    notification_channels JSONB DEFAULT '["email"]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    last_run TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for search criteria (optimized for common queries)
CREATE INDEX IF NOT EXISTS idx_search_criteria_user_id ON auto_alert_search_criteria(user_id);
CREATE INDEX IF NOT EXISTS idx_search_criteria_active ON auto_alert_search_criteria(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_search_criteria_user_active ON auto_alert_search_criteria(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_search_criteria_last_run ON auto_alert_search_criteria(last_run) WHERE is_active = TRUE;

-- GIN indices for JSONB criteria searches
CREATE INDEX IF NOT EXISTS idx_search_criteria_make ON auto_alert_search_criteria 
    USING GIN ((criteria->>'make')) WHERE criteria ? 'make';
CREATE INDEX IF NOT EXISTS idx_search_criteria_model ON auto_alert_search_criteria 
    USING GIN ((criteria->>'model')) WHERE criteria ? 'model';
CREATE INDEX IF NOT EXISTS idx_search_criteria_price_range ON auto_alert_search_criteria 
    USING GIN (criteria) WHERE criteria ? 'priceFrom' OR criteria ? 'priceTo';

-- ========================================
-- FOUND VEHICLES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS auto_alert_found_vehicles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    alert_id UUID REFERENCES auto_alert_search_criteria(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    price DECIMAL(10,2),
    year INTEGER,
    mileage INTEGER,
    location VARCHAR(255),
    image_url TEXT,
    mobile_de_url TEXT UNIQUE NOT NULL,
    vehicle_data JSONB,
    found_at TIMESTAMPTZ DEFAULT NOW(),
    notified_at TIMESTAMPTZ
);

-- Indices for found vehicles (optimized for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_found_vehicles_alert_id ON auto_alert_found_vehicles(alert_id);
CREATE INDEX IF NOT EXISTS idx_found_vehicles_found_at ON auto_alert_found_vehicles(found_at DESC);
CREATE INDEX IF NOT EXISTS idx_found_vehicles_price ON auto_alert_found_vehicles(price) WHERE price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_found_vehicles_year ON auto_alert_found_vehicles(year) WHERE year IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_found_vehicles_mileage ON auto_alert_found_vehicles(mileage) WHERE mileage IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_found_vehicles_mobile_url ON auto_alert_found_vehicles(mobile_de_url);

-- Composite indices for common filtering
CREATE INDEX IF NOT EXISTS idx_found_vehicles_alert_found_at ON auto_alert_found_vehicles(alert_id, found_at DESC);
CREATE INDEX IF NOT EXISTS idx_found_vehicles_price_year ON auto_alert_found_vehicles(price, year) 
    WHERE price IS NOT NULL AND year IS NOT NULL;

-- GIN index for vehicle data searches
CREATE INDEX IF NOT EXISTS idx_found_vehicles_data ON auto_alert_found_vehicles USING GIN (vehicle_data);

-- ========================================
-- NOTIFICATIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS auto_alert_notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auto_alert_user_profiles(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES auto_alert_search_criteria(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES auto_alert_found_vehicles(id) ON DELETE SET NULL,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'voice')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    message TEXT,
    response_data JSONB,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON auto_alert_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_alert_id ON auto_alert_notifications(alert_id) WHERE alert_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_status ON auto_alert_notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON auto_alert_notifications(channel);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON auto_alert_notifications(created_at DESC);

-- Composite indices for dashboard queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON auto_alert_notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON auto_alert_notifications(user_id, created_at DESC);

-- ========================================
-- MOBILE.DE CATEGORIES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS auto_alert_mobile_categories (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL,
    parent_id INTEGER,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    level INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for categories
CREATE UNIQUE INDEX IF NOT EXISTS idx_mobile_categories_category_id ON auto_alert_mobile_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_mobile_categories_parent_id ON auto_alert_mobile_categories(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mobile_categories_slug ON auto_alert_mobile_categories(slug);
CREATE INDEX IF NOT EXISTS idx_mobile_categories_active ON auto_alert_mobile_categories(is_active) WHERE is_active = TRUE;

-- ========================================
-- SEARCH PERFORMANCE TRACKING
-- ========================================
CREATE TABLE IF NOT EXISTS auto_alert_search_performance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    alert_id UUID REFERENCES auto_alert_search_criteria(id) ON DELETE CASCADE,
    search_duration_ms INTEGER,
    vehicles_found INTEGER DEFAULT 0,
    new_vehicles INTEGER DEFAULT 0,
    notifications_sent INTEGER DEFAULT 0,
    error_message TEXT,
    searched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for performance tracking
CREATE INDEX IF NOT EXISTS idx_search_performance_alert_id ON auto_alert_search_performance(alert_id);
CREATE INDEX IF NOT EXISTS idx_search_performance_searched_at ON auto_alert_search_performance(searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_performance_duration ON auto_alert_search_performance(search_duration_ms);

-- ========================================
-- USER ACTIVITY LOG
-- ========================================
CREATE TABLE IF NOT EXISTS auto_alert_user_activity (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auto_alert_user_profiles(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for user activity
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON auto_alert_user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON auto_alert_user_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON auto_alert_user_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_resource ON auto_alert_user_activity(resource_type, resource_id) 
    WHERE resource_type IS NOT NULL AND resource_id IS NOT NULL;

-- ========================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ========================================

-- User statistics view
CREATE MATERIALIZED VIEW IF NOT EXISTS auto_alert_user_stats AS
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    s.tier as subscription_tier,
    COUNT(DISTINCT sc.id) FILTER (WHERE sc.is_active = TRUE) as active_alerts,
    COUNT(DISTINCT fv.id) as total_vehicles_found,
    COUNT(DISTINCT n.id) FILTER (WHERE n.status = 'sent') as notifications_sent,
    u.last_login,
    u.created_at as user_since
FROM auto_alert_user_profiles u
LEFT JOIN auto_alert_subscriptions s ON u.id = s.user_id AND s.status IN ('active', 'past_due')
LEFT JOIN auto_alert_search_criteria sc ON u.id = sc.user_id
LEFT JOIN auto_alert_found_vehicles fv ON sc.id = fv.alert_id
LEFT JOIN auto_alert_notifications n ON u.id = n.user_id
GROUP BY u.id, u.email, u.name, s.tier, u.last_login, u.created_at;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_stats_user_id ON auto_alert_user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_tier ON auto_alert_user_stats(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_stats_active_alerts ON auto_alert_user_stats(active_alerts);

-- Alert performance view
CREATE MATERIALIZED VIEW IF NOT EXISTS auto_alert_performance_stats AS
SELECT 
    sc.id as alert_id,
    sc.name,
    sc.user_id,
    COUNT(DISTINCT fv.id) as total_vehicles_found,
    AVG(fv.price) as avg_price,
    MIN(fv.price) as min_price,
    MAX(fv.price) as max_price,
    COUNT(DISTINCT fv.id) FILTER (WHERE fv.found_at >= NOW() - INTERVAL '30 days') as vehicles_last_30_days,
    COUNT(DISTINCT n.id) FILTER (WHERE n.status = 'sent') as notifications_sent,
    sc.last_run,
    sc.is_active,
    sc.created_at
FROM auto_alert_search_criteria sc
LEFT JOIN auto_alert_found_vehicles fv ON sc.id = fv.alert_id
LEFT JOIN auto_alert_notifications n ON sc.id = n.alert_id
GROUP BY sc.id, sc.name, sc.user_id, sc.last_run, sc.is_active, sc.created_at;

-- Create index on performance stats
CREATE UNIQUE INDEX IF NOT EXISTS idx_performance_stats_alert_id ON auto_alert_performance_stats(alert_id);
CREATE INDEX IF NOT EXISTS idx_performance_stats_user_id ON auto_alert_performance_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_stats_active ON auto_alert_performance_stats(is_active) WHERE is_active = TRUE;

-- ========================================
-- FUNCTIONS FOR AUTOMATIC UPDATES
-- ========================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY auto_alert_user_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY auto_alert_performance_stats;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- TRIGGERS
-- ========================================

-- Triggers for updated_at columns
CREATE TRIGGER trigger_user_profiles_updated_at
    BEFORE UPDATE ON auto_alert_user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_subscriptions_updated_at
    BEFORE UPDATE ON auto_alert_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_search_criteria_updated_at
    BEFORE UPDATE ON auto_alert_search_criteria
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- SAMPLE DATA FOR DEVELOPMENT
-- ========================================

-- Insert sample mobile.de categories (only in development)
INSERT INTO auto_alert_mobile_categories (category_id, parent_id, name, slug, level) VALUES
(1, NULL, 'PKW', 'pkw', 0),
(2, 1, 'Kleinwagen', 'kleinwagen', 1),
(3, 1, 'Kompaktklasse', 'kompaktklasse', 1),
(4, 1, 'Mittelklasse', 'mittelklasse', 1),
(5, 1, 'Oberklasse', 'oberklasse', 1),
(6, 1, 'SUV/Geländewagen', 'suv-gelaendewagen', 1),
(7, 1, 'Sportwagen/Coupé', 'sportwagen-coupe', 1),
(8, 1, 'Cabrio/Roadster', 'cabrio-roadster', 1),
(9, 1, 'Kombi', 'kombi', 1),
(10, 1, 'Van/Kleinbus', 'van-kleinbus', 1)
ON CONFLICT (category_id) DO NOTHING;

-- ========================================
-- PERFORMANCE ANALYSIS QUERIES
-- ========================================

-- Query to analyze slow searches
CREATE OR REPLACE VIEW slow_searches AS
SELECT 
    sc.name as alert_name,
    sp.search_duration_ms,
    sp.vehicles_found,
    sp.searched_at,
    u.email as user_email
FROM auto_alert_search_performance sp
JOIN auto_alert_search_criteria sc ON sp.alert_id = sc.id
JOIN auto_alert_user_profiles u ON sc.user_id = u.id
WHERE sp.search_duration_ms > 5000  -- Searches taking more than 5 seconds
ORDER BY sp.search_duration_ms DESC;

-- Query to find unused indices
CREATE OR REPLACE VIEW unused_indices AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_tup_read = 0 AND idx_tup_fetch = 0
AND schemaname = 'auto_alert';

-- ========================================
-- MAINTENANCE PROCEDURES
-- ========================================

-- Procedure to clean up old notifications (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM auto_alert_notifications
    WHERE created_at < NOW() - INTERVAL '90 days'
    AND status IN ('sent', 'delivered');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Procedure to clean up old search performance records (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_search_performance()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM auto_alert_search_performance
    WHERE searched_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Procedure to clean up old user activity logs (keep last 180 days)
CREATE OR REPLACE FUNCTION cleanup_old_user_activity()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM auto_alert_user_activity
    WHERE created_at < NOW() - INTERVAL '180 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- GRANTS AND PERMISSIONS
-- ========================================

-- Grant permissions to application user (if exists)
-- These would be customized based on your specific user setup
-- GRANT USAGE ON SCHEMA auto_alert TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auto_alert TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auto_alert TO app_user;

COMMENT ON SCHEMA auto_alert IS 'Auto Alert SaaS application schema with optimized indices for performance';
COMMENT ON TABLE auto_alert_user_profiles IS 'User profiles with preferences and contact information';
COMMENT ON TABLE auto_alert_search_criteria IS 'User-defined search alerts with notification settings';
COMMENT ON TABLE auto_alert_found_vehicles IS 'Vehicles found matching search criteria';
COMMENT ON TABLE auto_alert_notifications IS 'Notification delivery tracking';
COMMENT ON TABLE auto_alert_subscriptions IS 'User subscription and billing information';
COMMENT ON TABLE auto_alert_search_performance IS 'Performance metrics for search operations';
COMMENT ON TABLE auto_alert_user_activity IS 'User activity audit log';

-- Final success message
SELECT 'Auto Alert SaaS database schema with performance optimizations created successfully!' as status;