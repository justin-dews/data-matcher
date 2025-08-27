-- Test extension functions directly to confirm they work or not
-- This will tell us definitively if the extensions are functional

-- Test 1: Check if extensions are installed
SELECT 
    extname as extension_name,
    extversion as version,
    nspname as schema
FROM pg_extension 
JOIN pg_namespace ON pg_extension.extnamespace = pg_namespace.oid
WHERE extname IN ('pg_trgm', 'fuzzystrmatch', 'unaccent', 'vector');

-- Test 2: Try to use similarity function (pg_trgm)
DO $$
BEGIN
    RAISE NOTICE 'Testing similarity function...';
    PERFORM similarity('test', 'testing');
    RAISE NOTICE 'SUCCESS: similarity function works!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'FAILED: similarity function error: %', SQLERRM;
END
$$;

-- Test 3: Try to use levenshtein function (fuzzystrmatch)
DO $$
BEGIN
    RAISE NOTICE 'Testing levenshtein function...';
    PERFORM levenshtein('test', 'testing');
    RAISE NOTICE 'SUCCESS: levenshtein function works!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'FAILED: levenshtein function error: %', SQLERRM;
END
$$;

-- Test 4: Try to use unaccent function
DO $$
BEGIN
    RAISE NOTICE 'Testing unaccent function...';
    PERFORM unaccent('café');
    RAISE NOTICE 'SUCCESS: unaccent function works!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'FAILED: unaccent function error: %', SQLERRM;
END
$$;

-- Test 5: Check available functions from these extensions
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_catalog.pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('similarity', 'levenshtein', 'unaccent')
ORDER BY schema_name, function_name;