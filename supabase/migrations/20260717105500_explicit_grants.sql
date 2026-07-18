-- Migration: Explicit Grants for Secure Defaults compatibility
-- This migration ensures that the API roles (anon, authenticated, service_role) have the correct privileges
-- on all existing tables, sequences, and functions, preventing breakage when Supabase enforces secure defaults.

-- 1. Grant table privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant sequence usage and select privileges
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Grant execution privileges on all functions in the public schema
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
