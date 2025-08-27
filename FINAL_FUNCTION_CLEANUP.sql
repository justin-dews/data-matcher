-- 🔧 FINAL FUNCTION CLEANUP - Fix PostgREST Overloading Conflict
-- This removes duplicate hybrid_product_match_tiered functions and deploys clean version

-- =============================================================================
-- CLEANUP: Remove ALL versions of hybrid_product_match_tiered
-- =============================================================================

DROP FUNCTION IF EXISTS hybrid_product_match_tiered(text, integer, decimal);
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(text, integer, numeric);
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(text, integer, double precision);
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(text, integer);
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(text);

SELECT 'All duplicate hybrid_product_match_tiered functions dropped' as cleanup_status;

-- =============================================================================
-- DEPLOY: Single clean version with NUMERIC type (PostgREST compatible)
-- =============================================================================

CREATE OR REPLACE FUNCTION hybrid_product_match_tiered(
    query_text TEXT,
    limit_count INTEGER DEFAULT 5,
    threshold NUMERIC DEFAULT 0.2
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
    reasoning TEXT
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
    
    -- 🎯 TIER 1: EXACT TRAINING MATCHES (Perfect 1.0 scores)
    RETURN QUERY
    SELECT 
        p.id,
        p.sku,
        p.name,
        p.manufacturer,
        p.category,
        1.0::NUMERIC as vector_score,
        1.0::NUMERIC as trigram_score,
        1.0::NUMERIC as fuzzy_score,
        1.0::NUMERIC as alias_score,
        1.0::NUMERIC as final_score,
        'training_exact'::TEXT as matched_via,
        '🎯 EXACT TRAINING MATCH - Perfect confidence'::TEXT as reasoning
    FROM match_training_data mtd
    JOIN products p ON mtd.matched_product_id = p.id
    WHERE mtd.line_item_normalized = normalized_query
    AND mtd.match_confidence >= 0.95
    ORDER BY mtd.training_weight DESC, mtd.approved_at DESC
    LIMIT limit_count;
    
    GET DIAGNOSTICS training_match_count = ROW_COUNT;
    IF training_match_count > 0 THEN RETURN; END IF;
    
    -- 🧠 TIER 2: HIGH-CONFIDENCE TRAINING MATCHES
    RETURN QUERY
    SELECT 
        p.id,
        p.sku,
        p.name,
        p.manufacturer,
        p.category,
        (0.85 + mtd.match_confidence * 0.1)::NUMERIC as vector_score,
        COALESCE(mtd.trigram_score, 0.0)::NUMERIC,
        COALESCE(mtd.fuzzy_score, 0.0)::NUMERIC,
        COALESCE(mtd.alias_score, 0.0)::NUMERIC,
        (0.85 + mtd.match_confidence * 0.1)::NUMERIC as final_score,
        'training_high'::TEXT as matched_via,
        ('🧠 HIGH CONFIDENCE TRAINING (' || ROUND((mtd.match_confidence * 100)::NUMERIC, 1) || '%)')::TEXT as reasoning
    FROM match_training_data mtd
    JOIN products p ON mtd.matched_product_id = p.id  
    WHERE mtd.line_item_normalized = normalized_query
    AND mtd.match_confidence >= training_threshold
    AND mtd.match_confidence < 0.95
    ORDER BY mtd.match_confidence DESC
    LIMIT limit_count;
    
    GET DIAGNOSTICS training_match_count = ROW_COUNT;
    IF training_match_count > 0 THEN RETURN; END IF;
    
    -- 🔍 TIER 3: ALGORITHMIC MATCHING (using extensions)
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
        )::NUMERIC as vector_score,
        GREATEST(
            COALESCE(similarity(p.name, query_text), 0),
            COALESCE(similarity(p.sku, query_text), 0)
        )::NUMERIC as trigram_score,
        GREATEST(
            CASE WHEN levenshtein(LOWER(p.name), normalized_query) <= 3 
                 THEN 1.0 - (levenshtein(LOWER(p.name), normalized_query)::NUMERIC / GREATEST(length(p.name), length(normalized_query)))
                 ELSE 0.0 END,
            CASE WHEN levenshtein(LOWER(p.sku), normalized_query) <= 2
                 THEN 1.0 - (levenshtein(LOWER(p.sku), normalized_query)::NUMERIC / GREATEST(length(p.sku), length(normalized_query)))
                 ELSE 0.0 END
        )::NUMERIC as fuzzy_score,
        COALESCE(
            (SELECT MAX(ca.confidence_score) * 0.3 
             FROM competitor_aliases ca 
             WHERE ca.product_id = p.id 
             AND similarity(ca.competitor_name, query_text) > 0.3), 
            0
        )::NUMERIC as alias_score,
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
        )::NUMERIC as final_score,
        'algorithmic'::TEXT as matched_via,
        ('⚡ ALGORITHMIC - Name: ' || 
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
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO anon;

-- =============================================================================
-- SCHEMA CACHE REFRESH
-- =============================================================================

-- Update comment to trigger cache refresh
COMMENT ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) IS 'FIXED: Single clean function - no overloading conflicts - PostgREST compatible';

-- Send PostgREST refresh signals
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT 'hybrid_product_match_tiered deployed successfully' as deployment_status;

-- Test the function
SELECT 'Testing function...' as test_status;
SELECT 
    product_id,
    sku,
    name,
    final_score,
    matched_via
FROM hybrid_product_match_tiered('test product', 3, 0.1)
LIMIT 1;

-- Verify no duplicate functions exist
SELECT 
    'Function verification:' as check_type,
    p.proname as function_name,
    pg_catalog.pg_get_function_arguments(p.oid) as signature
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'hybrid_product_match_tiered'
AND n.nspname = 'public'
ORDER BY p.proname;

SELECT '🎉 FUNCTION CLEANUP COMPLETED - Wait 30 seconds for API refresh' as final_status;