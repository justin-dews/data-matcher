-- 🔐 FIX AUTHENTICATED ROLE PERMISSIONS
-- The frontend uses authenticated users, but function may not have proper permissions

-- =============================================================================
-- STEP 1: VERIFY CURRENT PERMISSIONS
-- =============================================================================

SELECT 'Current function permissions check:' as status;

SELECT 
    'Permission status:' as check_type,
    has_function_privilege('anon', 'hybrid_product_match_tiered(text,integer,numeric)', 'execute') as anon_can_execute,
    has_function_privilege('authenticated', 'hybrid_product_match_tiered(text,integer,numeric)', 'execute') as authenticated_can_execute,
    has_function_privilege('service_role', 'hybrid_product_match_tiered(text,integer,numeric)', 'execute') as service_can_execute;

-- =============================================================================
-- STEP 2: GRANT EXPLICIT PERMISSIONS TO ALL ROLES
-- =============================================================================

-- Revoke all first to clean slate
REVOKE ALL ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) FROM anon;
REVOKE ALL ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) FROM authenticated;
REVOKE ALL ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) FROM service_role;

-- Grant explicit execute permissions
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO service_role;

-- Also grant to PUBLIC as fallback
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO PUBLIC;

SELECT 'Permissions granted to all roles' as status;

-- =============================================================================
-- STEP 3: VERIFY PERMISSIONS AFTER GRANT
-- =============================================================================

SELECT 
    'After permission grants:' as check_type,
    has_function_privilege('anon', 'hybrid_product_match_tiered(text,integer,numeric)', 'execute') as anon_can_execute,
    has_function_privilege('authenticated', 'hybrid_product_match_tiered(text,integer,numeric)', 'execute') as authenticated_can_execute,
    has_function_privilege('service_role', 'hybrid_product_match_tiered(text,integer,numeric)', 'execute') as service_can_execute;

-- =============================================================================
-- STEP 4: REFRESH POSTGREST SCHEMA CACHE
-- =============================================================================

-- Force PostgREST to notice permission changes
NOTIFY pgrst, 'reload schema';
COMMENT ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) IS 'Permissions fixed for authenticated role - all roles have execute access';

-- =============================================================================
-- STEP 5: VERIFY FUNCTION ACCESSIBILITY 
-- =============================================================================

-- Test function directly to ensure it works
SELECT 'Function test:' as test_phase;
SELECT 
    product_id,
    sku, 
    name,
    final_score,
    matched_via,
    is_training_match
FROM hybrid_product_match_tiered('test product', 2, 0.1)
LIMIT 1;

-- =============================================================================
-- STEP 6: CHECK INFORMATION_SCHEMA VISIBILITY
-- =============================================================================

-- Verify function is visible in information_schema (PostgREST uses this)
SELECT 
    'PostgREST visibility check:' as check_type,
    routine_name,
    routine_type,
    data_type as return_type,
    routine_schema
FROM information_schema.routines 
WHERE routine_name = 'hybrid_product_match_tiered'
AND routine_schema = 'public';

SELECT 'AUTHENTICATED PERMISSIONS FIX COMPLETE' as final_status;
SELECT 'Wait 30 seconds, then test frontend - authenticated users should now have access' as next_step;