-- Simple PostgREST Schema Cache Refresh
-- This will force PostgREST to recognize the function

-- Step 1: Verify function exists in database
SELECT 
    p.proname as function_name,
    n.nspname as schema_name,
    pg_catalog.pg_get_function_arguments(p.oid) as full_signature
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'hybrid_product_match_tiered'
ORDER BY p.proname;

-- Step 2: Multiple schema refresh signals
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Step 3: Update function comment to trigger cache invalidation
COMMENT ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) IS 'CACHE REFRESH: Sophisticated 3-tier product matching - refreshed';

-- Step 4: Grant explicit permissions again
REVOKE ALL ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) FROM anon;  
REVOKE ALL ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) FROM authenticated;

GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO PUBLIC;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO authenticated;

-- Step 5: Test the function directly
SELECT 'Testing function directly in SQL:' as test_status;

SELECT 
    product_id,
    sku,
    name,
    trigram_score,
    final_score,
    matched_via
FROM hybrid_product_match_tiered('power probe', 3, 0.1);

-- Step 6: Final refresh signals
NOTIFY pgrst, 'reload schema';

SELECT 'Schema refresh completed - function should now be available via API' as final_status;