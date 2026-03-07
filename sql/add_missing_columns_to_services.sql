-- SQL Migration for missing columns in the services table
-- Use this in your Supabase SQL Editor

-- 1. Add description and warranty columns if they don't exist
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS warranty TEXT DEFAULT '90 dias';

-- 2. Add commission-related columns
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS commission_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percentage';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS commission_value NUMERIC DEFAULT 0;

-- 3. (Optional) Multi-tenant: ensure company_id exists
-- ALTER TABLE public.services ADD COLUMN IF NOT EXISTS company_id UUID;
