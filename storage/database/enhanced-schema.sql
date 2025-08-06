-- Enhanced Auto-Alert Storage Infrastructure Schema
-- Migration: 20250805220000_enhanced_storage_architecture
-- Database: PostgreSQL 15+ with extensions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Performance monitoring schema
CREATE SCHEMA IF NOT EXISTS monitoring;
CREATE SCHEMA IF NOT EXISTS cache_management;
CREATE SCHEMA IF NOT EXISTS file_storage;

-- Enhanced user profiles with file storage tracking
DROP TABLE IF EXISTS public.auto_alert_user_profiles CASCADE;
CREATE TABLE public.auto_alert_user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'business', 'enterprise')),
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "voice": false, "push": false}'::jsonb,
    max_searches INTEGER DEFAULT 2,
    max_file_storage_mb INTEGER DEFAULT 100, -- File storage limit in MB
    retell_phone_number TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced searches with advanced filtering and caching hints
DROP TABLE IF EXISTS public.auto_alert_searches CASCADE;
CREATE TABLE public.auto_alert_searches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.auto_alert_user_profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    
    -- Vehicle criteria
    make TEXT,
    model TEXT,
    model_description TEXT,
    price_min INTEGER,
    price_max INTEGER,
    year_min INTEGER,
    year_max INTEGER,
    mileage_max INTEGER,
    power_min INTEGER,
    power_max INTEGER,
    damage_allowed BOOLEAN DEFAULT false,
    fuel_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    gearbox_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    body_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Location and radius
    region TEXT,
    postal_code TEXT,
    radius_km INTEGER DEFAULT 50,
    
    -- Search behavior
    active BOOLEAN DEFAULT true,
    search_frequency_minutes INTEGER DEFAULT 60,
    last_search_at TIMESTAMP WITH TIME ZONE,
    next_search_at TIMESTAMP WITH TIME ZONE,
    
    -- Notification settings
    notification_methods TEXT[] DEFAULT ARRAY['email']::TEXT[],
    notification_cooldown_minutes INTEGER DEFAULT 60,
    
    -- Performance optimization
    search_hash TEXT, -- Hash of search criteria for deduplication
    cache_ttl_seconds INTEGER DEFAULT 300,
    
    -- Analytics
    total_searches INTEGER DEFAULT 0,
    total_results_found INTEGER DEFAULT 0,
    total_notifications_sent INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced results with image storage and performance data
DROP TABLE IF EXISTS public.auto_alert_results CASCADE;
CREATE TABLE public.auto_alert_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_id UUID REFERENCES public.auto_alert_searches(id) ON DELETE CASCADE NOT NULL,
    
    -- Vehicle identification
    mobile_ad_id TEXT UNIQUE NOT NULL,
    portal TEXT DEFAULT 'mobile.de',
    external_id TEXT, -- Portal-specific ID
    
    -- Vehicle details
    title TEXT,
    make TEXT,
    model TEXT,
    model_description TEXT,
    price INTEGER,
    price_currency TEXT DEFAULT 'EUR',
    year INTEGER,
    mileage INTEGER,
    fuel TEXT,
    gearbox TEXT,
    power INTEGER,
    power_unit TEXT DEFAULT 'kW',
    
    -- Condition
    damage_unrepaired BOOLEAN DEFAULT false,
    accident_damaged BOOLEAN DEFAULT false,
    condition_description TEXT,
    
    -- Additional details
    body_type TEXT,
    doors INTEGER,
    seats INTEGER,
    color TEXT,
    interior_color TEXT,
    equipment JSONB DEFAULT '[]'::jsonb,
    
    -- Seller information
    seller_type TEXT,
    seller_name TEXT,
    seller_city TEXT,
    seller_zipcode TEXT,
    seller_company TEXT,
    seller_phone TEXT,
    
    -- URLs and media
    detail_url TEXT,
    image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    cached_images JSONB DEFAULT '[]'::jsonb, -- Local image references
    
    -- Timestamps
    found_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notified_at TIMESTAMP WITH TIME ZONE,
    
    -- Notification tracking
    notification_methods_sent TEXT[] DEFAULT ARRAY[]::TEXT[],
    notification_attempts INTEGER DEFAULT 0,
    
    -- Performance metrics
    scrape_duration_ms INTEGER,
    data_quality_score DECIMAL(3,2) DEFAULT 1.0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_duplicate BOOLEAN DEFAULT false,
    duplicate_of UUID REFERENCES public.auto_alert_results(id)
);

-- Enhanced notification logs with delivery tracking
DROP TABLE IF EXISTS public.auto_alert_notifications CASCADE;
CREATE TABLE public.auto_alert_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    result_id UUID REFERENCES public.auto_alert_results(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.auto_alert_user_profiles(id) ON DELETE CASCADE NOT NULL,
    search_id UUID REFERENCES public.auto_alert_searches(id) ON DELETE CASCADE NOT NULL,
    
    -- Notification details
    notification_type TEXT NOT NULL CHECK (notification_type IN ('email', 'sms', 'voice', 'push', 'webhook')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'opened', 'clicked')),
    
    -- Provider information
    provider TEXT, -- 'resend', 'retell', 'expo', 'webhook'
    provider_id TEXT, -- External provider's message/call ID
    provider_response JSONB,
    
    -- Content
    subject TEXT,
    content TEXT,
    template_used TEXT,
    
    -- Delivery tracking
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- Cost tracking
    cost_cents INTEGER DEFAULT 0,
    cost_currency TEXT DEFAULT 'EUR'
);

-- File storage tracking table
CREATE TABLE file_storage.user_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.auto_alert_user_profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- File details
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'avatar', 'export', 'document', 'image'
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    
    -- Storage details
    storage_path TEXT NOT NULL,
    storage_provider TEXT DEFAULT 'local', -- 'local', 's3', 'cloudinary'
    public_url TEXT,
    cdn_url TEXT,
    
    -- Security
    access_level TEXT DEFAULT 'private' CHECK (access_level IN ('private', 'public', 'shared')),
    checksum TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Lifecycle
    expires_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cache invalidation tracking
CREATE TABLE cache_management.cache_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cache_key TEXT UNIQUE NOT NULL,
    cache_type TEXT NOT NULL, -- 'search_results', 'user_profile', 'notifications'
    entity_id UUID, -- Related entity ID
    user_id UUID REFERENCES public.auto_alert_user_profiles(id) ON DELETE CASCADE,
    
    -- Cache lifecycle
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    invalidated_at TIMESTAMP WITH TIME ZONE,
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMP WITH TIME ZONE,
    
    -- Dependencies
    depends_on_tables TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Metadata
    size_bytes INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Performance monitoring tables
CREATE TABLE monitoring.query_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_hash TEXT NOT NULL,
    query_text TEXT,
    execution_time_ms DECIMAL(10,3) NOT NULL,
    rows_returned INTEGER,
    rows_examined INTEGER,
    
    -- Context
    user_id UUID REFERENCES public.auto_alert_user_profiles(id) ON DELETE SET NULL,
    endpoint TEXT,
    
    -- Performance metrics
    cpu_time_ms DECIMAL(10,3),
    io_wait_ms DECIMAL(10,3),
    memory_usage_kb INTEGER,
    
    -- Optimization hints
    index_usage JSONB,
    slow_query BOOLEAN DEFAULT false,
    
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE monitoring.system_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    metric_unit TEXT,
    
    -- Context
    service_name TEXT DEFAULT 'database',
    instance_id TEXT,
    
    -- Tags for filtering
    tags JSONB DEFAULT '{}'::jsonb,
    
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Advanced indexes for high-performance queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active ON public.auto_alert_user_profiles(email) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_subscription_tier ON public.auto_alert_user_profiles(subscription_tier);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login ON public.auto_alert_user_profiles(last_login_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_searches_user_active ON public.auto_alert_searches(user_id, active) WHERE active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_searches_next_search ON public.auto_alert_searches(next_search_at) WHERE active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_searches_hash ON public.auto_alert_searches(search_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_searches_criteria_gin ON public.auto_alert_searches USING gin(make, model, fuel_types, region);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_results_search_found ON public.auto_alert_results(search_id, found_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_results_mobile_ad_active ON public.auto_alert_results(mobile_ad_id) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_results_price_range ON public.auto_alert_results(price) WHERE price IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_results_year_mileage ON public.auto_alert_results(year, mileage) WHERE year IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_results_location ON public.auto_alert_results(seller_zipcode, seller_city);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_status ON public.auto_alert_notifications(user_id, status, sent_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_retry ON public.auto_alert_notifications(next_retry_at) WHERE status = 'failed' AND retry_count < max_retries;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_delivery_tracking ON public.auto_alert_notifications(provider, provider_id) WHERE provider_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_user_type ON file_storage.user_files(user_id, file_type) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_expires ON file_storage.user_files(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_size ON file_storage.user_files(file_size_bytes DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_expires ON cache_management.cache_keys(expires_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_type_entity ON cache_management.cache_keys(cache_type, entity_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_perf_slow ON monitoring.query_performance(executed_at DESC) WHERE slow_query = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_metrics_name_time ON monitoring.system_metrics(metric_name, recorded_at DESC);

-- Full-text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_results_fulltext ON public.auto_alert_results USING gin(to_tsvector('german', coalesce(title, '') || ' ' || coalesce(model_description, '') || ' ' || coalesce(equipment::text, '')));

-- Partitioning for large tables (notifications and monitoring)
-- Note: These would be implemented as separate migration steps in production

-- Advanced trigger functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION calculate_search_hash()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_hash = md5(
        coalesce(NEW.make, '') || '|' ||
        coalesce(NEW.model, '') || '|' ||
        coalesce(NEW.model_description, '') || '|' ||
        coalesce(NEW.price_min::text, '') || '|' ||
        coalesce(NEW.price_max::text, '') || '|' ||
        coalesce(NEW.year_min::text, '') || '|' ||
        coalesce(NEW.year_max::text, '') || '|' ||
        coalesce(NEW.mileage_max::text, '') || '|' ||
        coalesce(NEW.damage_allowed::text, '') || '|' ||
        coalesce(array_to_string(NEW.fuel_types, ','), '') || '|' ||
        coalesce(NEW.region, '')
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION invalidate_cache_on_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Invalidate related cache entries
    UPDATE cache_management.cache_keys 
    SET invalidated_at = NOW()
    WHERE entity_id = NEW.id OR entity_id = OLD.id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_search_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.auto_alert_searches 
        SET total_results_found = total_results_found + 1,
            last_search_at = NOW()
        WHERE id = NEW.search_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_notification_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'sent' THEN
        UPDATE public.auto_alert_searches 
        SET total_notifications_sent = total_notifications_sent + 1
        WHERE id = NEW.search_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER trigger_update_users_updated_at 
    BEFORE UPDATE ON public.auto_alert_user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_searches_updated_at 
    BEFORE UPDATE ON public.auto_alert_searches 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_calculate_search_hash 
    BEFORE INSERT OR UPDATE ON public.auto_alert_searches 
    FOR EACH ROW EXECUTE FUNCTION calculate_search_hash();

CREATE TRIGGER trigger_update_files_updated_at 
    BEFORE UPDATE ON file_storage.user_files 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_invalidate_cache_searches 
    AFTER UPDATE ON public.auto_alert_searches 
    FOR EACH ROW EXECUTE FUNCTION invalidate_cache_on_update();

CREATE TRIGGER trigger_update_search_stats 
    AFTER INSERT ON public.auto_alert_results 
    FOR EACH ROW EXECUTE FUNCTION update_search_stats();

CREATE TRIGGER trigger_update_notification_stats 
    AFTER INSERT ON public.auto_alert_notifications 
    FOR EACH ROW EXECUTE FUNCTION update_notification_stats();

-- Views for common queries
CREATE OR REPLACE VIEW public.active_searches AS
SELECT 
    s.*,
    u.email as user_email,
    u.subscription_tier,
    COUNT(r.id) as total_results,
    MAX(r.found_at) as last_result_at
FROM public.auto_alert_searches s
JOIN public.auto_alert_user_profiles u ON s.user_id = u.id
LEFT JOIN public.auto_alert_results r ON s.id = r.search_id AND r.is_active = true
WHERE s.active = true AND u.is_active = true
GROUP BY s.id, u.email, u.subscription_tier;

CREATE OR REPLACE VIEW public.recent_results AS
SELECT 
    r.*,
    s.name as search_name,
    u.email as user_email,
    COUNT(n.id) as notification_count
FROM public.auto_alert_results r
JOIN public.auto_alert_searches s ON r.search_id = s.id
JOIN public.auto_alert_user_profiles u ON s.user_id = u.id
LEFT JOIN public.auto_alert_notifications n ON r.id = n.result_id
WHERE r.is_active = true
    AND r.found_at > NOW() - INTERVAL '7 days'
GROUP BY r.id, s.name, u.email
ORDER BY r.found_at DESC;

-- Row Level Security (RLS) policies
ALTER TABLE public.auto_alert_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_alert_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_alert_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_alert_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_storage.user_files ENABLE ROW LEVEL SECURITY;

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA monitoring TO anon, authenticated;
GRANT USAGE ON SCHEMA cache_management TO anon, authenticated;
GRANT USAGE ON SCHEMA file_storage TO anon, authenticated;

GRANT SELECT ON monitoring.system_metrics TO authenticated;
GRANT INSERT ON monitoring.query_performance TO authenticated;
GRANT ALL ON cache_management.cache_keys TO authenticated;
GRANT ALL ON file_storage.user_files TO authenticated;