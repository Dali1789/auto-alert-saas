-- Auto-Alert SaaS Database Schema
-- Migration: 20250805133000_create_auto_alert_schema

-- Create user profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.auto_alert_user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'business')),
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "voice": false}'::jsonb,
    max_searches INTEGER DEFAULT 2,
    retell_phone_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create searches table
CREATE TABLE IF NOT EXISTS public.auto_alert_searches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.auto_alert_user_profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    make TEXT,
    model TEXT,
    model_description TEXT,
    price_min INTEGER,
    price_max INTEGER,
    year_min INTEGER,
    year_max INTEGER,
    mileage_max INTEGER,
    damage_allowed BOOLEAN DEFAULT false,
    fuel_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    region TEXT,
    active BOOLEAN DEFAULT true,
    notification_methods TEXT[] DEFAULT ARRAY['email']::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create results table (found vehicles)
CREATE TABLE IF NOT EXISTS public.auto_alert_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_id UUID REFERENCES public.auto_alert_searches(id) ON DELETE CASCADE NOT NULL,
    mobile_ad_id TEXT UNIQUE NOT NULL,
    portal TEXT DEFAULT 'mobile.de',
    title TEXT,
    make TEXT,
    model TEXT,
    model_description TEXT,
    price INTEGER,
    year INTEGER,
    mileage INTEGER,
    fuel TEXT,
    gearbox TEXT,
    power INTEGER,
    damage_unrepaired BOOLEAN DEFAULT false,
    accident_damaged BOOLEAN DEFAULT false,
    detail_url TEXT,
    seller_type TEXT,
    seller_city TEXT,
    seller_zipcode TEXT,
    seller_company TEXT,
    found_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notified_at TIMESTAMP WITH TIME ZONE,
    notification_methods_sent TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Create notification logs table
CREATE TABLE IF NOT EXISTS public.auto_alert_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    result_id UUID REFERENCES public.auto_alert_results(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.auto_alert_user_profiles(id) ON DELETE CASCADE NOT NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('email', 'sms', 'voice')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    provider TEXT, -- 'resend', 'retell', etc.
    provider_id TEXT, -- External provider's message/call ID
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_auto_alert_searches_user_id ON public.auto_alert_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_alert_searches_active ON public.auto_alert_searches(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_auto_alert_results_search_id ON public.auto_alert_results(search_id);
CREATE INDEX IF NOT EXISTS idx_auto_alert_results_found_at ON public.auto_alert_results(found_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_alert_results_mobile_ad_id ON public.auto_alert_results(mobile_ad_id);
CREATE INDEX IF NOT EXISTS idx_auto_alert_notifications_user_id ON public.auto_alert_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_alert_notifications_sent_at ON public.auto_alert_notifications(sent_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_auto_alert_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_auto_alert_user_profiles_updated_at 
    BEFORE UPDATE ON public.auto_alert_user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_auto_alert_updated_at_column();

CREATE TRIGGER update_auto_alert_searches_updated_at 
    BEFORE UPDATE ON public.auto_alert_searches 
    FOR EACH ROW EXECUTE FUNCTION update_auto_alert_updated_at_column();

-- Insert sample data for testing
INSERT INTO public.auto_alert_user_profiles (email, subscription_tier, max_searches, notification_preferences) 
VALUES 
    ('demo@autoalert.com', 'pro', 10, '{"email": true, "sms": true, "voice": true}'::jsonb),
    ('test@autoalert.com', 'free', 2, '{"email": true, "sms": false, "voice": false}'::jsonb)
ON CONFLICT (email) DO NOTHING;

-- Insert sample search
INSERT INTO public.auto_alert_searches (user_id, name, make, model_description, price_max, year_min, active, notification_methods)
SELECT id, 'BMW 740d Premium Suche', 'BMW', '740d', 25000, 2017, true, ARRAY['email', 'voice']::TEXT[]
FROM public.auto_alert_user_profiles 
WHERE email = 'demo@autoalert.com'
ON CONFLICT DO NOTHING;