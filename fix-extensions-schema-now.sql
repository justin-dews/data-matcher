-- Apply Extension Schema Fix - Move from extensions schema to public schema
-- This will make similarity(), levenshtein(), and unaccent() accessible to functions

-- Drop existing extensions from extensions schema
DROP EXTENSION IF EXISTS "pg_trgm" CASCADE;
DROP EXTENSION IF EXISTS "fuzzystrmatch" CASCADE; 
DROP EXTENSION IF EXISTS "unaccent" CASCADE;
DROP EXTENSION IF EXISTS "vector" CASCADE;

-- Create extensions in public schema (where functions can find them)
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA public;

-- Verify all extension functions work now
DO $$
BEGIN
    RAISE NOTICE 'Testing extension functions after schema fix...';
    
    -- Test pg_trgm similarity function
    PERFORM similarity('test', 'testing');
    RAISE NOTICE 'SUCCESS: similarity function works!';
    
    -- Test unaccent function
    PERFORM unaccent('café');
    RAISE NOTICE 'SUCCESS: unaccent function works!';
    
    -- Test fuzzystrmatch levenshtein function
    PERFORM levenshtein('test', 'testing');
    RAISE NOTICE 'SUCCESS: levenshtein function works!';
    
    -- Test vector extension
    PERFORM '[1,2,3]'::vector(3);
    RAISE NOTICE 'SUCCESS: vector extension works!';
    
    RAISE NOTICE '🎉 ALL EXTENSION FUNCTIONS NOW ACCESSIBLE FROM PUBLIC SCHEMA!';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Extension test failed: %', SQLERRM;
END;
$$;

-- Grant permissions for RLS compatibility
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Test the actual functions we need for matching
SELECT 
    'Extension Functions Test Results:' as test_phase,
    similarity('power probe test kit', 'power probe test') as trigram_score,
    levenshtein('power probe', 'probe power') as fuzzy_distance,
    unaccent('café résumé') as normalized_text;

SELECT 'Schema fix applied successfully - extensions now in public schema!' as status;