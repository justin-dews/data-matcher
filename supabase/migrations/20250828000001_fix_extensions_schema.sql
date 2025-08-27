-- Fix PostgreSQL Extensions Schema for Supabase Hosted Database
-- Problem: Extensions were created in 'extensions' schema but functions need to be in public schema
-- Solution: Recreate extensions in public schema and verify function availability

-- Drop existing extensions from extensions schema (if they exist)
DROP EXTENSION IF EXISTS "pg_trgm";
DROP EXTENSION IF EXISTS "fuzzystrmatch"; 
DROP EXTENSION IF EXISTS "unaccent";
DROP EXTENSION IF EXISTS "vector";

-- Create extensions in public schema (available to all functions)
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA public;

-- Verify extensions are properly installed by testing key functions
DO $$
BEGIN
    -- Test pg_trgm similarity function
    IF similarity('test', 'test') <> 1.0 THEN
        RAISE EXCEPTION 'pg_trgm similarity function not working properly';
    END IF;
    
    -- Test unaccent function
    IF unaccent('café') <> 'cafe' THEN
        RAISE EXCEPTION 'unaccent function not working properly';
    END IF;
    
    -- Test fuzzystrmatch levenshtein function
    IF levenshtein('test', 'test') <> 0 THEN
        RAISE EXCEPTION 'fuzzystrmatch levenshtein function not working properly';
    END IF;
    
    -- Test vector extension (basic vector creation)
    PERFORM '[1,2,3]'::vector(3);
    
    RAISE NOTICE 'All PostgreSQL extensions verified successfully';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Extension verification failed: %', SQLERRM;
END;
$$;

-- Update search_path to ensure extensions schema is included for future sessions
-- Note: This is mainly for completeness as public schema should be sufficient
ALTER DATABASE postgres SET search_path TO public, extensions;

-- Grant necessary permissions on extension functions (for RLS compatibility)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Log successful migration
INSERT INTO migrations_log (version, description, applied_at) 
VALUES ('20250828000001', 'Fixed PostgreSQL extensions schema for Supabase hosted database', NOW())
ON CONFLICT DO NOTHING;

-- Final verification query that can be run manually
-- SELECT 
--   extname as extension_name,
--   extnamespace::regnamespace as schema_name,
--   extversion as version
-- FROM pg_extension 
-- WHERE extname IN ('vector', 'pg_trgm', 'fuzzystrmatch', 'unaccent')
-- ORDER BY extname;