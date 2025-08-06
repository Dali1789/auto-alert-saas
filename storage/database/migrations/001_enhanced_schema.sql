-- Migration: 001_enhanced_schema.sql
-- Description: Enhanced storage architecture with performance optimizations
-- Created: 2025-08-05
-- Dependencies: PostgreSQL 15+, required extensions

BEGIN;

-- Migration metadata
INSERT INTO public.schema_migrations (version, name, executed_at) 
VALUES ('001', 'enhanced_schema', NOW())
ON CONFLICT (version) DO NOTHING;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Create monitoring schemas
CREATE SCHEMA IF NOT EXISTS monitoring;
CREATE SCHEMA IF NOT EXISTS cache_management;
CREATE SCHEMA IF NOT EXISTS file_storage;

-- Enhanced user profiles table
CREATE TABLE IF NOT EXISTS public.auto_alert_user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'business', 'enterprise')),
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Limits and quotas
    max_searches INTEGER DEFAULT 2,
    max_file_storage_mb INTEGER DEFAULT 100,
    max_notifications_per_day INTEGER DEFAULT 10,
    
    -- Contact preferences
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "voice": false, "push": false}'::jsonb,
    retell_phone_number TEXT,
    mobile_number TEXT,
    
    -- Profile information
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    
    -- Settings and preferences
    preferences JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Security and tracking
    password_hash TEXT,
    last_login_at TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced searches table with advanced filtering
CREATE TABLE IF NOT EXISTS public.auto_alert_searches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.auto_alert_user_profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Vehicle search criteria
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
    
    -- Condition filters
    damage_allowed BOOLEAN DEFAULT false,
    accident_free_only BOOLEAN DEFAULT false,
    non_smoker_only BOOLEAN DEFAULT false,
    
    -- Technical specifications
    fuel_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    gearbox_types TEXT[] DEFAULT ARRAY['manual', 'automatic']::TEXT[],
    drive_types TEXT[] DEFAULT ARRAY[]::TEXT[], -- fwd, rwd, awd
    body_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    door_count INTEGER[],
    seat_count INTEGER[],
    
    -- Color preferences
    exterior_colors TEXT[] DEFAULT ARRAY[]::TEXT[],
    interior_colors TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Equipment and features
    required_features TEXT[] DEFAULT ARRAY[]::TEXT[],
    preferred_features TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Location and search area
    region TEXT,
    postal_code TEXT,
    radius_km INTEGER DEFAULT 50,
    search_multiple_regions BOOLEAN DEFAULT false,
    additional_regions TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Search behavior and scheduling
    active BOOLEAN DEFAULT true,
    search_frequency_minutes INTEGER DEFAULT 60,
    search_only_business_hours BOOLEAN DEFAULT false,
    search_weekends BOOLEAN DEFAULT true,
    last_search_at TIMESTAMP WITH TIME ZONE,
    next_search_at TIMESTAMP WITH TIME ZONE,
    
    -- Notification settings
    notification_methods TEXT[] DEFAULT ARRAY['email']::TEXT[],
    notification_cooldown_minutes INTEGER DEFAULT 60,
    max_notifications_per_day INTEGER DEFAULT 5,
    notification_summary_enabled BOOLEAN DEFAULT true,
    
    -- Performance optimization
    search_hash TEXT GENERATED ALWAYS AS (
        md5(
            coalesce(make, '') || '|' ||
            coalesce(model, '') || '|' ||
            coalesce(model_description, '') || '|' ||
            coalesce(price_min::text, '') || '|' ||
            coalesce(price_max::text, '') || '|' ||
            coalesce(year_min::text, '') || '|' ||
            coalesce(year_max::text, '') || '|' ||
            coalesce(mileage_max::text, '') || '|' ||
            coalesce(damage_allowed::text, '') || '|' ||
            coalesce(array_to_string(fuel_types, ','), '') || '|' ||
            coalesce(region, '')
        )
    ) STORED,
    cache_ttl_seconds INTEGER DEFAULT 300,
    
    -- Analytics and statistics
    total_searches INTEGER DEFAULT 0,
    total_results_found INTEGER DEFAULT 0,
    total_notifications_sent INTEGER DEFAULT 0,
    average_results_per_search DECIMAL(10,2) DEFAULT 0,
    last_result_found_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps and lifecycle
    paused_at TIMESTAMP WITH TIME ZONE,
    paused_reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced results table with comprehensive vehicle data
CREATE TABLE IF NOT EXISTS public.auto_alert_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_id UUID REFERENCES public.auto_alert_searches(id) ON DELETE CASCADE NOT NULL,
    
    -- External identifiers
    mobile_ad_id TEXT UNIQUE NOT NULL,
    portal TEXT DEFAULT 'mobile.de',
    external_id TEXT,
    external_url TEXT,
    
    -- Vehicle basic information
    title TEXT,
    make TEXT,
    model TEXT,
    model_description TEXT,
    vin TEXT,
    
    -- Pricing information
    price INTEGER,
    price_currency TEXT DEFAULT 'EUR',
    original_price INTEGER,
    price_negotiable BOOLEAN DEFAULT true,
    financing_available BOOLEAN DEFAULT false,
    leasing_available BOOLEAN DEFAULT false,
    
    -- Technical specifications
    year INTEGER,
    mileage INTEGER,
    fuel TEXT,
    fuel_consumption_combined DECIMAL(4,1),
    fuel_consumption_city DECIMAL(4,1),
    fuel_consumption_highway DECIMAL(4,1),
    co2_emissions INTEGER,
    emission_class TEXT,
    
    -- Engine and performance
    power INTEGER,
    power_unit TEXT DEFAULT 'kW',
    engine_size_cc INTEGER,
    cylinders INTEGER,
    gearbox TEXT,
    drive_type TEXT,
    
    -- Body and design
    body_type TEXT,
    doors INTEGER,
    seats INTEGER,
    exterior_color TEXT,
    interior_color TEXT,
    interior_material TEXT,
    
    -- Condition and history
    condition_rating INTEGER, -- 1-5 scale
    damage_unrepaired BOOLEAN DEFAULT false,
    accident_damaged BOOLEAN DEFAULT false,
    accident_free BOOLEAN DEFAULT true,
    non_smoker_vehicle BOOLEAN DEFAULT false,
    service_history_complete BOOLEAN DEFAULT false,
    
    -- Equipment and features
    standard_equipment JSONB DEFAULT '[]'::jsonb,
    optional_equipment JSONB DEFAULT '[]'::jsonb,
    safety_features JSONB DEFAULT '[]'::jsonb,
    comfort_features JSONB DEFAULT '[]'::jsonb,
    
    -- Inspection and certification
    tuv_until DATE,
    au_until DATE,
    warranty_months INTEGER,
    warranty_km INTEGER,
    
    -- Seller information
    seller_type TEXT,
    seller_name TEXT,
    seller_rating DECIMAL(3,2),
    seller_reviews_count INTEGER,
    seller_address JSONB,
    seller_city TEXT,
    seller_zipcode TEXT,
    seller_state TEXT,
    seller_country TEXT DEFAULT 'DE',
    seller_company TEXT,
    seller_phone TEXT,
    seller_email TEXT,
    
    -- Media and presentation
    image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    video_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    cached_images JSONB DEFAULT '[]'::jsonb,
    thumbnail_url TEXT,
    
    -- Detailed URLs
    detail_url TEXT,
    mobile_url TEXT,
    share_url TEXT,
    
    -- Tracking and lifecycle
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    found_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notified_at TIMESTAMP WITH TIME ZONE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    favorited_at TIMESTAMP WITH TIME ZONE,
    
    -- Notification tracking
    notification_methods_sent TEXT[] DEFAULT ARRAY[]::TEXT[],
    notification_attempts INTEGER DEFAULT 0,
    notification_cooldown_until TIMESTAMP WITH TIME ZONE,
    
    -- Data quality and processing
    scrape_duration_ms INTEGER,
    data_quality_score DECIMAL(3,2) DEFAULT 1.0,
    data_completeness_score DECIMAL(3,2) DEFAULT 1.0,
    processing_errors JSONB DEFAULT '[]'::jsonb,
    
    -- Duplicate detection
    is_duplicate BOOLEAN DEFAULT false,
    duplicate_of UUID REFERENCES public.auto_alert_results(id),
    similarity_score DECIMAL(3,2),
    
    -- Status and flags
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    is_promoted BOOLEAN DEFAULT false,
    is_sold BOOLEAN DEFAULT false,
    marked_as_spam BOOLEAN DEFAULT false,
    user_hidden BOOLEAN DEFAULT false,
    
    -- Pricing analysis
    market_price_estimate INTEGER,
    price_below_market BOOLEAN,
    price_drop_amount INTEGER,
    price_history JSONB DEFAULT '[]'::jsonb,
    
    -- Geographic data
    coordinates POINT,
    distance_from_user_km DECIMAL(8,2),
    
    CONSTRAINT valid_coordinates CHECK (coordinates IS NULL OR (coordinates[0] BETWEEN -180 AND 180 AND coordinates[1] BETWEEN -90 AND 90))
);

-- Enhanced notifications table with detailed tracking
CREATE TABLE IF NOT EXISTS public.auto_alert_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    result_id UUID REFERENCES public.auto_alert_results(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.auto_alert_user_profiles(id) ON DELETE CASCADE NOT NULL,
    search_id UUID REFERENCES public.auto_alert_searches(id) ON DELETE CASCADE NOT NULL,
    
    -- Notification type and method
    notification_type TEXT NOT NULL CHECK (notification_type IN ('email', 'sms', 'voice', 'push', 'webhook', 'slack', 'discord')),
    template_id TEXT,
    template_version TEXT,
    
    -- Status and lifecycle
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sending', 'sent', 'failed', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
    priority INTEGER DEFAULT 0, -- Higher number = higher priority
    
    -- Provider integration
    provider TEXT,
    provider_id TEXT,
    provider_response JSONB,
    provider_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Content and personalization
    subject TEXT,
    content TEXT,
    html_content TEXT,
    personalization_data JSONB DEFAULT '{}'::jsonb,
    
    -- Recipient information
    recipient_email TEXT,
    recipient_phone TEXT,
    recipient_device_token TEXT,
    recipient_webhook_url TEXT,
    
    -- Delivery tracking with detailed timestamps
    queued_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    bounced_at TIMESTAMP WITH TIME ZONE,
    complained_at TIMESTAMP WITH TIME ZONE,
    
    -- Error handling and retry logic
    error_message TEXT,
    error_code TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    backoff_multiplier DECIMAL(3,2) DEFAULT 2.0,
    
    -- Cost tracking and analytics
    cost_cents INTEGER DEFAULT 0,
    cost_currency TEXT DEFAULT 'EUR',
    
    -- Campaign and batch tracking
    campaign_id TEXT,
    batch_id TEXT,
    
    -- Engagement metrics
    click_count INTEGER DEFAULT 0,
    click_urls JSONB DEFAULT '[]'::jsonb,
    user_agent TEXT,
    ip_address INET,
    
    -- A/B testing
    variant TEXT,
    test_group TEXT,
    
    CONSTRAINT valid_retry_logic CHECK (retry_count <= max_retries)
);

-- File storage system
CREATE TABLE IF NOT EXISTS file_storage.user_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.auto_alert_user_profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- File identification and naming
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    display_name TEXT,
    
    -- File classification
    file_type TEXT NOT NULL CHECK (file_type IN ('avatar', 'vehicle-image', 'document', 'export', 'thumbnail', 'temp')),
    category TEXT,
    mime_type TEXT NOT NULL,
    file_extension TEXT,
    
    -- Size and storage information
    file_size_bytes BIGINT NOT NULL,
    compressed_size_bytes BIGINT,
    
    -- Storage backend details
    storage_path TEXT NOT NULL,
    storage_provider TEXT DEFAULT 'local' CHECK (storage_provider IN ('local', 's3', 'cloudinary', 'gcs')),
    storage_bucket TEXT,
    storage_region TEXT,
    
    -- URLs and access
    public_url TEXT,
    cdn_url TEXT,
    signed_url TEXT,
    signed_url_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Security and access control
    access_level TEXT DEFAULT 'private' CHECK (access_level IN ('private', 'public', 'shared', 'internal')),
    access_token TEXT,
    download_token TEXT,
    
    -- File integrity and verification
    checksum TEXT,
    checksum_algorithm TEXT DEFAULT 'sha256',
    
    -- Image-specific metadata
    image_width INTEGER,
    image_height INTEGER,
    image_format TEXT,
    has_thumbnail BOOLEAN DEFAULT false,
    thumbnail_url TEXT,
    
    -- Relationships and associations
    associated_entity_type TEXT, -- 'vehicle', 'user', 'search', etc.
    associated_entity_id UUID,
    parent_file_id UUID REFERENCES file_storage.user_files(id),
    
    -- Organization and tagging
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    alt_text TEXT,
    description TEXT,
    
    -- Lifecycle management
    expires_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    permanent_delete_at TIMESTAMP WITH TIME ZONE,
    
    -- Usage tracking
    download_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    last_modified_at TIMESTAMP WITH TIME ZONE,
    
    -- Virus scanning
    virus_scan_status TEXT DEFAULT 'pending' CHECK (virus_scan_status IN ('pending', 'clean', 'infected', 'error')),
    virus_scan_at TIMESTAMP WITH TIME ZONE,
    virus_scan_result JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_file_size CHECK (file_size_bytes > 0),
    CONSTRAINT valid_image_dimensions CHECK (
        (image_width IS NULL AND image_height IS NULL) OR 
        (image_width > 0 AND image_height > 0)
    )
);

-- Cache management system
CREATE TABLE IF NOT EXISTS cache_management.cache_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cache_key TEXT UNIQUE NOT NULL,
    cache_type TEXT NOT NULL,
    cache_namespace TEXT DEFAULT 'default',
    
    -- Entity associations
    entity_type TEXT,
    entity_id UUID,
    user_id UUID REFERENCES public.auto_alert_user_profiles(id) ON DELETE CASCADE,
    
    -- Cache lifecycle
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    invalidated_at TIMESTAMP WITH TIME ZONE,
    
    -- Usage statistics
    hit_count INTEGER DEFAULT 0,
    miss_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMP WITH TIME ZONE,
    
    -- Cache dependencies and invalidation
    depends_on_tables TEXT[] DEFAULT ARRAY[]::TEXT[],
    depends_on_keys TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Cache data
    size_bytes INTEGER,
    compression_ratio DECIMAL(4,2),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Performance metrics
    average_fetch_time_ms DECIMAL(10,3),
    cache_efficiency_score DECIMAL(3,2),
    
    CONSTRAINT valid_expiry CHECK (expires_at > created_at),
    CONSTRAINT valid_efficiency CHECK (cache_efficiency_score IS NULL OR (cache_efficiency_score >= 0 AND cache_efficiency_score <= 1))
);

-- Performance monitoring tables
CREATE TABLE IF NOT EXISTS monitoring.query_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_hash TEXT NOT NULL,
    query_type TEXT, -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
    query_text TEXT,
    normalized_query TEXT,
    
    -- Performance metrics
    execution_time_ms DECIMAL(10,3) NOT NULL,
    planning_time_ms DECIMAL(10,3),
    rows_returned INTEGER,
    rows_examined INTEGER,
    rows_affected INTEGER,
    
    -- System resources
    cpu_time_ms DECIMAL(10,3),
    io_read_time_ms DECIMAL(10,3),
    io_write_time_ms DECIMAL(10,3),
    memory_usage_kb INTEGER,
    temp_files_count INTEGER,
    temp_files_size_kb INTEGER,
    
    -- Context information
    user_id UUID REFERENCES public.auto_alert_user_profiles(id) ON DELETE SET NULL,
    session_id TEXT,
    endpoint TEXT,
    request_id TEXT,
    
    -- Query optimization
    index_usage JSONB,
    table_scans JSONB,
    join_types JSONB,
    
    -- Classification
    slow_query BOOLEAN DEFAULT false,
    optimization_candidate BOOLEAN DEFAULT false,
    
    -- Environment
    database_name TEXT,
    schema_name TEXT,
    application_name TEXT,
    
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitoring.system_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('counter', 'gauge', 'histogram', 'summary')),
    metric_value DECIMAL(15,6) NOT NULL,
    metric_unit TEXT,
    
    -- Context and dimensions
    service_name TEXT DEFAULT 'database',
    instance_id TEXT,
    node_name TEXT,
    environment TEXT DEFAULT 'production',
    
    -- Hierarchical organization
    namespace TEXT DEFAULT 'auto_alert',
    subsystem TEXT,
    component TEXT,
    
    -- Flexible tagging system
    tags JSONB DEFAULT '{}'::jsonb,
    
    -- Additional metrics for histograms/summaries
    sample_count INTEGER,
    sum_value DECIMAL(15,6),
    min_value DECIMAL(15,6),
    max_value DECIMAL(15,6),
    percentile_50 DECIMAL(15,6),
    percentile_90 DECIMAL(15,6),
    percentile_95 DECIMAL(15,6),
    percentile_99 DECIMAL(15,6),
    
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User activity and audit logging
CREATE TABLE IF NOT EXISTS monitoring.user_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.auto_alert_user_profiles(id) ON DELETE CASCADE,
    session_id TEXT,
    
    -- Activity details
    activity_type TEXT NOT NULL,
    activity_category TEXT,
    activity_description TEXT,
    
    -- Context
    endpoint TEXT,
    http_method TEXT,
    user_agent TEXT,
    ip_address INET,
    
    -- Request/Response data
    request_data JSONB,
    response_status INTEGER,
    response_time_ms INTEGER,
    
    -- Geographic information
    country_code CHAR(2),
    region_code TEXT,
    city TEXT,
    timezone TEXT,
    
    -- Device information
    device_type TEXT,
    browser_name TEXT,
    browser_version TEXT,
    os_name TEXT,
    os_version TEXT,
    
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMIT;