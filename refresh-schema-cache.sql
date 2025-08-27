-- Refresh Supabase schema cache
-- This forces Supabase to recognize newly created/updated functions

-- Option 1: Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Option 2: Update function comment to trigger cache refresh
COMMENT ON FUNCTION hybrid_product_match_tiered(text, integer, numeric) IS 'Updated: Tiered product matching with training data priority';

-- Option 3: Verify function exists and is accessible
SELECT 
    p.proname as function_name,
    p.proargtypes::regtype[] as argument_types,
    p.prorettype::regtype as return_type,
    p.prosecdef as is_security_definer,
    n.nspname as schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'hybrid_product_match_tiered';

-- Option 4: Test direct function call
SELECT 'Testing function...' as test_status;
SELECT * FROM hybrid_product_match_tiered('test product', 3, 0.1) LIMIT 1;