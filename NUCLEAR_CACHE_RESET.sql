-- 🚀 NUCLEAR CACHE RESET - Completely clear PostgREST function cache
-- This handles the PGRST202 "function not found in schema cache" error

-- =============================================================================
-- STEP 1: COMPLETELY DROP ALL VERSIONS
-- =============================================================================

DROP FUNCTION IF EXISTS hybrid_product_match_tiered(text, integer, decimal);
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(text, integer, numeric); 
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(text, integer, double precision);
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(text, integer);
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(text);
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(integer, text, numeric);  -- Wrong parameter order
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(integer, text, decimal);  -- Wrong parameter order
DROP FUNCTION IF EXISTS hybrid_product_match_tiered();

-- Also drop any old version that might exist
DROP FUNCTION IF EXISTS hybrid_product_match(text, integer, numeric);
DROP FUNCTION IF EXISTS hybrid_product_match(text, integer, decimal);

SELECT 'All function versions dropped - cache cleared' as status;

-- =============================================================================
-- STEP 2: WAIT FOR POSTGREST TO NOTICE
-- =============================================================================

-- Send clear cache signals
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Wait a moment
SELECT pg_sleep(1);

-- =============================================================================
-- STEP 3: CREATE CLEAN FUNCTION WITH EXACT SIGNATURE
-- =============================================================================

CREATE OR REPLACE FUNCTION hybrid_product_match_tiered(
    query_text TEXT,           -- Parameter 1: search text
    limit_count INTEGER DEFAULT 5,     -- Parameter 2: result limit  
    threshold NUMERIC DEFAULT 0.2      -- Parameter 3: confidence threshold
) RETURNS TABLE (
    product_id UUID,
    sku TEXT,
    name TEXT,
    manufacturer TEXT,
    category TEXT,
    vector_score NUMERIC,
    trigram_score NUMERIC,
    fuzzy_score NUMERIC,
    alias_score NUMERIC,
    final_score NUMERIC,
    matched_via TEXT,
    reasoning TEXT,
    is_training_match BOOLEAN
) AS $$
DECLARE
    normalized_query TEXT;
    training_match_count INTEGER := 0;
    training_threshold NUMERIC := 0.8;
BEGIN
    -- Input validation
    IF query_text IS NULL OR LENGTH(TRIM(query_text)) = 0 THEN
        RETURN;
    END IF;
    
    normalized_query := LOWER(TRIM(REGEXP_REPLACE(query_text, '\s+', ' ', 'g')));
    
    -- TIER 1: EXACT TRAINING MATCHES
    RETURN QUERY
    SELECT 
        p.id,
        p.sku,
        p.name,
        p.manufacturer,
        p.category,
        1.0::NUMERIC,
        1.0::NUMERIC,
        1.0::NUMERIC,
        1.0::NUMERIC,
        1.0::NUMERIC,
        'training_exact'::TEXT,
        '🎯 EXACT TRAINING MATCH'::TEXT,
        TRUE
    FROM match_training_data mtd
    JOIN products p ON mtd.matched_product_id = p.id
    WHERE mtd.line_item_normalized = normalized_query
    AND mtd.match_confidence >= 0.95
    ORDER BY mtd.training_weight DESC
    LIMIT limit_count;
    
    GET DIAGNOSTICS training_match_count = ROW_COUNT;
    IF training_match_count > 0 THEN RETURN; END IF;
    
    -- TIER 2: HIGH-CONFIDENCE TRAINING MATCHES  
    RETURN QUERY
    SELECT 
        p.id,
        p.sku,
        p.name,
        p.manufacturer,
        p.category,
        (0.85 + mtd.match_confidence * 0.1)::NUMERIC,
        COALESCE(mtd.trigram_score, 0.0)::NUMERIC,
        COALESCE(mtd.fuzzy_score, 0.0)::NUMERIC,
        COALESCE(mtd.alias_score, 0.0)::NUMERIC,
        (0.85 + mtd.match_confidence * 0.1)::NUMERIC,
        'training_high'::TEXT,
        ('🧠 HIGH TRAINING (' || ROUND((mtd.match_confidence * 100)::NUMERIC, 1) || '%)')::TEXT,
        TRUE
    FROM match_training_data mtd
    JOIN products p ON mtd.matched_product_id = p.id  
    WHERE mtd.line_item_normalized = normalized_query
    AND mtd.match_confidence >= training_threshold
    AND mtd.match_confidence < 0.95
    ORDER BY mtd.match_confidence DESC
    LIMIT limit_count;
    
    GET DIAGNOSTICS training_match_count = ROW_COUNT;
    IF training_match_count > 0 THEN RETURN; END IF;
    
    -- TIER 3: ALGORITHMIC MATCHING
    RETURN QUERY
    SELECT 
        p.id,
        p.sku,
        p.name,
        p.manufacturer,
        p.category,
        GREATEST(
            COALESCE(similarity(p.name, query_text), 0) * 0.6,
            COALESCE(similarity(p.sku, query_text), 0) * 0.4
        )::NUMERIC,
        GREATEST(
            COALESCE(similarity(p.name, query_text), 0),
            COALESCE(similarity(p.sku, query_text), 0)
        )::NUMERIC,
        GREATEST(
            CASE WHEN levenshtein(LOWER(p.name), normalized_query) <= 3 
                 THEN 1.0 - (levenshtein(LOWER(p.name), normalized_query)::NUMERIC / GREATEST(length(p.name), length(normalized_query)))
                 ELSE 0.0 END,
            CASE WHEN levenshtein(LOWER(p.sku), normalized_query) <= 2
                 THEN 1.0 - (levenshtein(LOWER(p.sku), normalized_query)::NUMERIC / GREATEST(length(p.sku), length(normalized_query)))
                 ELSE 0.0 END
        )::NUMERIC,
        COALESCE(
            (SELECT MAX(ca.confidence_score) * 0.3 
             FROM competitor_aliases ca 
             WHERE ca.product_id = p.id 
             AND similarity(ca.competitor_name, query_text) > 0.3), 
            0
        )::NUMERIC,
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
        )::NUMERIC,
        'algorithmic'::TEXT,
        ('⚡ ALGORITHMIC - Name: ' || 
         ROUND((COALESCE(similarity(p.name, query_text), 0) * 100)::NUMERIC, 1) || 
         '%, SKU: ' || ROUND((COALESCE(similarity(p.sku, query_text), 0) * 100)::NUMERIC, 1) || '%')::TEXT,
        FALSE
    FROM products p
    WHERE (
        similarity(p.name, query_text) > 0.15 OR
        similarity(p.sku, query_text) > 0.15 OR
        levenshtein(LOWER(p.name), normalized_query) <= 5
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
-- STEP 4: EXPLICIT PERMISSION GRANTS
-- =============================================================================

-- Grant to all roles explicitly
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO PUBLIC;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO service_role;

-- =============================================================================
-- STEP 5: AGGRESSIVE CACHE REFRESH
-- =============================================================================

-- Add unique comment to force cache invalidation
COMMENT ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) IS 'NUCLEAR RESET: Clean function signature - no overloading - cache cleared completely';

-- Multiple cache refresh signals
NOTIFY pgrst, 'reload schema';
SELECT pg_sleep(1);
NOTIFY pgrst, 'reload config';  
SELECT pg_sleep(1);
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- STEP 6: VERIFICATION
-- =============================================================================

-- Verify function exists with correct signature
SELECT 
    'Function verification' as check_type,
    p.proname as function_name,
    pg_catalog.pg_get_function_arguments(p.oid) as signature,
    p.prosecdef as security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'hybrid_product_match_tiered'
AND n.nspname = 'public'
ORDER BY p.oid;

-- Test function directly
SELECT 'Function test' as test_type;
SELECT 
    product_id,
    sku,
    name,
    final_score,
    matched_via,
    is_training_match
FROM hybrid_product_match_tiered('test product', 2, 0.1)
LIMIT 1;

-- Check PostgREST schema visibility  
SELECT 
    'PostgREST schema check' as check_type,
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_name = 'hybrid_product_match_tiered'
AND routine_schema = 'public';

SELECT 'NUCLEAR CACHE RESET COMPLETE - Wait 60 seconds before testing frontend' as final_status;