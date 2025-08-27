-- Aggressive PostgREST Schema Cache Refresh
-- This will force PostgREST to recognize the function

-- Step 1: Verify function exists in database
SELECT 
    p.proname as function_name,
    p.proargtypes::regtype[] as argument_types,
    p.prorettype::regtype as return_type,
    p.prosecdef as is_security_definer,
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
COMMENT ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) IS 'CACHE REFRESH: Sophisticated 3-tier product matching - timestamp: ' || NOW()::text;

-- Step 4: Grant explicit permissions again (sometimes this triggers refresh)
REVOKE ALL ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) FROM anon;  
REVOKE ALL ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) FROM authenticated;

GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO PUBLIC;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO authenticated;

-- Step 5: Test the function directly (this should work)
SELECT 'Direct SQL test of function:' as test_phase;
SELECT 
    product_id,
    sku,
    name,
    trigram_score,
    final_score,
    matched_via
FROM hybrid_product_match_tiered('power probe', 3, 0.1);

-- Step 6: Check if PostgREST can see the function in the schema introspection
SELECT 
    routine_name,
    routine_type,
    data_type,
    routine_schema
FROM information_schema.routines 
WHERE routine_name = 'hybrid_product_match_tiered'
    AND routine_schema = 'public';

-- Step 7: Force a database connection refresh by checking connection info
SELECT 
    'Connection info - this may trigger PostgREST refresh:' as info,
    current_database(),
    current_user,
    inet_server_addr(),
    inet_server_port(),
    version();

-- Step 8: Final refresh signals
NOTIFY pgrst, 'reload schema';

SELECT 'Schema cache refresh completed - wait 30-60 seconds for API availability' as status;