-- 🚀 COMPREHENSIVE FUNCTION DEPLOYMENT & SCHEMA CACHE REFRESH
-- This script ensures all required functions are deployed and PostgREST recognizes them
-- Target: Resolve PostgREST schema cache issues preventing API access

-- =============================================================================
-- PHASE 1: VERIFY EXTENSIONS (Should already be enabled)
-- =============================================================================

SELECT 'Verifying extensions...' as status;
SELECT 
    extname as extension_name,
    'enabled' as status
FROM pg_extension 
WHERE extname IN ('pg_trgm', 'fuzzystrmatch', 'unaccent', 'vector')
ORDER BY extname;

-- =============================================================================
-- PHASE 2: DEPLOY CORE HYBRID MATCHING FUNCTION  
-- =============================================================================

-- Drop existing function to ensure clean deployment
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(text, integer, decimal);
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(text, integer, numeric);

SELECT 'Deploying hybrid_product_match_tiered function...' as status;

CREATE OR REPLACE FUNCTION hybrid_product_match_tiered(
    query_text TEXT,
    limit_count INTEGER DEFAULT 5,
    threshold DECIMAL DEFAULT 0.2
) RETURNS TABLE (
    product_id UUID,
    sku TEXT,
    name TEXT,
    manufacturer TEXT,
    category TEXT,
    vector_score DECIMAL,
    trigram_score DECIMAL,
    fuzzy_score DECIMAL,
    alias_score DECIMAL,
    final_score DECIMAL,
    matched_via TEXT,
    reasoning TEXT
) AS $$
DECLARE
    normalized_query TEXT;
    training_match_count INTEGER := 0;
    training_threshold DECIMAL := 0.8;
BEGIN
    -- Input validation and normalization
    IF query_text IS NULL OR LENGTH(TRIM(query_text)) = 0 THEN
        RETURN;
    END IF;
    
    normalized_query := LOWER(TRIM(REGEXP_REPLACE(query_text, '\s+', ' ', 'g')));
    
    -- 🎯 TIER 1: EXACT TRAINING DATA MATCHES (Perfect 1.0 scores)
    RETURN QUERY
    SELECT 
        p.id,
        p.sku,
        p.name,
        p.manufacturer,
        p.category,
        1.0::DECIMAL as vector_score,
        1.0::DECIMAL as trigram_score,  
        1.0::DECIMAL as fuzzy_score,
        1.0::DECIMAL as alias_score,
        1.0::DECIMAL as final_score,
        'training_exact'::TEXT as matched_via,
        '🎯 EXACT TRAINING MATCH - Perfect confidence from learned data'::TEXT as reasoning
    FROM match_training_data mtd
    JOIN products p ON mtd.matched_product_id = p.id
    WHERE mtd.line_item_normalized = normalized_query
    AND mtd.match_confidence >= 0.95
    ORDER BY mtd.training_weight DESC, mtd.approved_at DESC
    LIMIT limit_count;
    
    GET DIAGNOSTICS training_match_count = ROW_COUNT;
    
    -- If we found exact training matches, return them only
    IF training_match_count > 0 THEN
        RETURN;
    END IF;
    
    -- 🧠 TIER 2: HIGH-CONFIDENCE TRAINING MATCHES (0.8-0.95 confidence)  
    RETURN QUERY
    SELECT 
        p.id,
        p.sku,
        p.name,
        p.manufacturer,
        p.category,
        (0.85 + mtd.match_confidence * 0.1)::DECIMAL as vector_score,
        COALESCE(mtd.trigram_score, 0.0)::DECIMAL,
        COALESCE(mtd.fuzzy_score, 0.0)::DECIMAL,
        COALESCE(mtd.alias_score, 0.0)::DECIMAL,
        (0.85 + mtd.match_confidence * 0.1)::DECIMAL as final_score,
        'training_high'::TEXT as matched_via,
        ('🧠 HIGH CONFIDENCE TRAINING MATCH (' || ROUND((mtd.match_confidence * 100)::NUMERIC, 1) || '% learned confidence)')::TEXT as reasoning
    FROM match_training_data mtd
    JOIN products p ON mtd.matched_product_id = p.id  
    WHERE mtd.line_item_normalized = normalized_query
    AND mtd.match_confidence >= training_threshold
    AND mtd.match_confidence < 0.95
    ORDER BY mtd.match_confidence DESC, mtd.training_weight DESC
    LIMIT limit_count;
    
    GET DIAGNOSTICS training_match_count = ROW_COUNT;
    
    -- If we found good training matches, return them only
    IF training_match_count > 0 THEN
        RETURN;
    END IF;
    
    -- 🔍 TIER 3: ALGORITHMIC HYBRID MATCHING 
    -- Uses extension functions: similarity() from pg_trgm, levenshtein() from fuzzystrmatch
    RETURN QUERY
    SELECT 
        p.id,
        p.sku,
        p.name,
        p.manufacturer,
        p.category,
        -- Vector score (trigram-based)
        GREATEST(
            COALESCE(similarity(p.name, query_text), 0) * 0.6,
            COALESCE(similarity(p.sku, query_text), 0) * 0.4
        )::DECIMAL as vector_score,
        -- Trigram score
        GREATEST(
            COALESCE(similarity(p.name, query_text), 0),
            COALESCE(similarity(p.sku, query_text), 0)
        )::DECIMAL as trigram_score,
        -- Fuzzy score (Levenshtein distance)
        GREATEST(
            CASE WHEN levenshtein(LOWER(p.name), normalized_query) <= 3 
                 THEN 1.0 - (levenshtein(LOWER(p.name), normalized_query)::DECIMAL / GREATEST(length(p.name), length(normalized_query)))
                 ELSE 0.0 END,
            CASE WHEN levenshtein(LOWER(p.sku), normalized_query) <= 2
                 THEN 1.0 - (levenshtein(LOWER(p.sku), normalized_query)::DECIMAL / GREATEST(length(p.sku), length(normalized_query)))
                 ELSE 0.0 END
        )::DECIMAL as fuzzy_score,
        -- Alias score
        COALESCE(
            (SELECT MAX(ca.confidence_score) * 0.3 
             FROM competitor_aliases ca 
             WHERE ca.product_id = p.id 
             AND similarity(ca.competitor_name, query_text) > 0.3), 
            0
        )::DECIMAL as alias_score,
        -- Final weighted score
        LEAST(
            GREATEST(
                COALESCE(similarity(p.name, query_text), 0) * 0.5 +
                COALESCE(similarity(p.sku, query_text), 0) * 0.3 +
                COALESCE(
                    (SELECT MAX(ca.confidence_score) * 0.2 
                     FROM competitor_aliases ca 
                     WHERE ca.product_id = p.id 
                     AND similarity(ca.competitor_name, query_text) > 0.2), 
                    0
                )
            ), 1.0
        )::DECIMAL as final_score,
        'algorithmic'::TEXT as matched_via,
        ('⚡ ALGORITHMIC MATCHING - Name: ' || 
         ROUND((COALESCE(similarity(p.name, query_text), 0) * 100)::NUMERIC, 1) || 
         '%, SKU: ' || ROUND((COALESCE(similarity(p.sku, query_text), 0) * 100)::NUMERIC, 1) || '%')::TEXT as reasoning
    FROM products p
    WHERE (
        similarity(p.name, query_text) > 0.15 OR
        similarity(p.sku, query_text) > 0.15 OR
        levenshtein(LOWER(p.name), normalized_query) <= 5 OR
        EXISTS (
            SELECT 1 FROM competitor_aliases ca 
            WHERE ca.product_id = p.id 
            AND similarity(ca.competitor_name, query_text) > 0.2
        )
    )
    ORDER BY (
        COALESCE(similarity(p.name, query_text), 0) * 0.5 +
        COALESCE(similarity(p.sku, query_text), 0) * 0.3 +
        COALESCE(
            (SELECT MAX(ca.confidence_score) * 0.2 
             FROM competitor_aliases ca 
             WHERE ca.product_id = p.id 
             AND similarity(ca.competitor_name, query_text) > 0.2), 
            0
        )
    ) DESC
    LIMIT limit_count;

END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
STABLE;

-- =============================================================================
-- PHASE 3: VERIFY ALL REQUIRED FUNCTIONS EXIST
-- =============================================================================

SELECT 'Verifying all required functions exist...' as status;

SELECT 
    p.proname as function_name,
    pg_catalog.pg_get_function_arguments(p.oid) as signature,
    p.prosecdef as security_definer,
    n.nspname as schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('hybrid_product_match_tiered', 'get_line_items_with_matches_optimized', 'get_match_statistics_optimized')
ORDER BY p.proname;

-- =============================================================================
-- PHASE 4: AGGRESSIVE SCHEMA CACHE REFRESH
-- =============================================================================

SELECT 'Starting aggressive schema cache refresh...' as status;

-- Step 1: Multiple refresh signals
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst;

-- Step 2: Update function comments with unique timestamps to force cache invalidation
COMMENT ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, DECIMAL) IS 'CACHE REFRESH: Advanced tiered product matching - ' || NOW()::text;
COMMENT ON FUNCTION get_line_items_with_matches_optimized(UUID, INTEGER, INTEGER) IS 'CACHE REFRESH: Optimized line items query - ' || NOW()::text;  
COMMENT ON FUNCTION get_match_statistics_optimized(UUID) IS 'CACHE REFRESH: Optimized statistics query - ' || NOW()::text;

-- Step 3: Revoke and re-grant permissions to trigger permission cache refresh
REVOKE ALL ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, DECIMAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_line_items_with_matches_optimized(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_match_statistics_optimized(UUID) FROM PUBLIC;

-- Grant to all relevant roles
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, DECIMAL) TO service_role;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, DECIMAL) TO anon;

GRANT EXECUTE ON FUNCTION get_line_items_with_matches_optimized(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_line_items_with_matches_optimized(UUID, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_line_items_with_matches_optimized(UUID, INTEGER, INTEGER) TO anon;

GRANT EXECUTE ON FUNCTION get_match_statistics_optimized(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_match_statistics_optimized(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_match_statistics_optimized(UUID) TO anon;

-- Step 4: Force connection refresh by updating connection info
SELECT 
    'Connection refresh signal' as operation,
    current_database() as database,
    current_user as user,
    version() as postgres_version,
    NOW() as timestamp;

-- Step 5: Final refresh signals with delay
SELECT pg_sleep(1);
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst;

-- =============================================================================
-- PHASE 5: FUNCTION TESTING & VERIFICATION
-- =============================================================================

SELECT 'Testing function functionality...' as status;

-- Test hybrid_product_match_tiered function
SELECT 'Testing hybrid_product_match_tiered...' as test_phase;
SELECT 
    product_id,
    sku,
    name,
    final_score,
    matched_via,
    reasoning
FROM hybrid_product_match_tiered('test product', 3, 0.1)
LIMIT 1;

-- Test optimized functions (will use first organization)
DO $$
DECLARE
    test_org_id UUID;
BEGIN
    SELECT id INTO test_org_id FROM organizations LIMIT 1;
    
    IF test_org_id IS NOT NULL THEN
        RAISE NOTICE 'Testing optimized functions with org: %', test_org_id;
        
        -- Test line items query  
        PERFORM get_line_items_with_matches_optimized(test_org_id, 5, 0);
        
        -- Test statistics query
        PERFORM get_match_statistics_optimized(test_org_id);
        
        RAISE NOTICE 'All function tests completed successfully';
    ELSE
        RAISE NOTICE 'No organizations found for testing';
    END IF;
END
$$;

-- =============================================================================
-- PHASE 6: FINAL STATUS & INSTRUCTIONS
-- =============================================================================

SELECT '🚀 COMPREHENSIVE DEPLOYMENT COMPLETED!' as status;
SELECT 'Functions deployed and schema cache refreshed' as result;
SELECT 'Wait 30-60 seconds for PostgREST to recognize functions via API' as instruction;

-- Check that we can see functions in information_schema (PostgREST uses this)
SELECT 
    'PostgREST Schema Visibility Check' as check_type,
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('hybrid_product_match_tiered', 'get_line_items_with_matches_optimized', 'get_match_statistics_optimized')
    AND routine_schema = 'public'
ORDER BY routine_name;

-- Performance hint
SELECT 'NEXT STEP: Test frontend API calls to verify 404 errors are resolved' as next_action;