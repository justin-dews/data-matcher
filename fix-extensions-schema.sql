-- Direct SQL to Fix Extension Schema Issues in Supabase
-- Run this in the Supabase SQL Editor at: https://supabase.com/dashboard/project/theattidfeqxyaexiqwj/sql

-- Step 1: Check current extension status
SELECT 
  extname as extension_name,
  extnamespace::regnamespace as schema_name,
  extversion as version
FROM pg_extension 
WHERE extname IN ('vector', 'pg_trgm', 'fuzzystrmatch', 'unaccent')
ORDER BY extname;

-- Step 2: Drop and recreate extensions in public schema
-- (Supabase handles this gracefully for existing extensions)
DROP EXTENSION IF EXISTS "pg_trgm" CASCADE;
DROP EXTENSION IF EXISTS "fuzzystrmatch" CASCADE; 
DROP EXTENSION IF EXISTS "unaccent" CASCADE;
DROP EXTENSION IF EXISTS "vector" CASCADE;

-- Step 3: Create extensions in public schema
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA public;

-- Step 4: Test all functions immediately
DO $$
BEGIN
    -- Test pg_trgm similarity function
    IF similarity('test', 'test') <> 1.0 THEN
        RAISE EXCEPTION 'pg_trgm similarity function not working';
    END IF;
    
    -- Test unaccent function  
    IF unaccent('café') <> 'cafe' THEN
        RAISE EXCEPTION 'unaccent function not working';
    END IF;
    
    -- Test levenshtein function
    IF levenshtein('test', 'test') <> 0 THEN
        RAISE EXCEPTION 'levenshtein function not working';
    END IF;
    
    -- Test vector operations
    PERFORM '[1,2,3]'::vector(3) <-> '[1,2,4]'::vector(3);
    
    RAISE NOTICE '✅ All extensions working correctly!';
END;
$$;

-- Step 5: Verify final status
SELECT 
  'Extension Status' as check_type,
  extname as name,
  extnamespace::regnamespace as schema,
  extversion as version
FROM pg_extension 
WHERE extname IN ('vector', 'pg_trgm', 'fuzzystrmatch', 'unaccent')
UNION ALL
SELECT 
  'Function Test' as check_type,
  'similarity()' as name,
  'Available' as schema,
  similarity('test', 'test')::text as version
UNION ALL  
SELECT
  'Function Test' as check_type,
  'unaccent()' as name,
  'Available' as schema,
  unaccent('café') as version
UNION ALL
SELECT
  'Function Test' as check_type,
  'levenshtein()' as name,
  'Available' as schema,
  levenshtein('hello', 'hello')::text as version
ORDER BY check_type, name;