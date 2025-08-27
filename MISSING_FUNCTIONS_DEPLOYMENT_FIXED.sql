-- 🔧 MISSING FUNCTIONS DEPLOYMENT - FIXED VERSION
-- This deploys the critical hybrid_product_match_tiered function with proper type casting

-- =============================================================================
-- DEPLOY HYBRID MATCHING FUNCTION
-- =============================================================================
-- This is the core function that the app needs for matching

-- Drop and recreate optimized hybrid matching function
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(text, integer, decimal);

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
    batch_size INTEGER := 100;
BEGIN
    -- Input validation and normalization
    IF query_text IS NULL OR LENGTH(TRIM(query_text)) = 0 THEN
        RETURN;
    END IF;
    
    normalized_query := LOWER(TRIM(REGEXP_REPLACE(query_text, '\s+', ' ', 'g')));
    
    -- 🎯 TIER 1: EXACT TRAINING DATA MATCHES (Perfect 1.0 scores)
    -- These get absolute priority and perfect confidence
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
    
    -- 🔍 TIER 3: PARTIAL TRAINING PATTERN MATCHING
    -- Look for partial matches in training data with similarity boost
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
        )::DECIMAL as vector_score,
        GREATEST(
            COALESCE(similarity(p.name, query_text), 0),
            COALESCE(similarity(p.sku, query_text), 0)
        )::DECIMAL as trigram_score,
        GREATEST(
            CASE WHEN levenshtein_less_equal(LOWER(p.name), normalized_query, 3) IS NOT NULL 
                 THEN 1.0 - (levenshtein_less_equal(LOWER(p.name), normalized_query, 3)::DECIMAL / 3.0)
                 ELSE 0.0 END,
            CASE WHEN levenshtein_less_equal(LOWER(p.sku), normalized_query, 2) IS NOT NULL 
                 THEN 1.0 - (levenshtein_less_equal(LOWER(p.sku), normalized_query, 2)::DECIMAL / 2.0)
                 ELSE 0.0 END
        )::DECIMAL as fuzzy_score,
        COALESCE(
            (SELECT MAX(ca.confidence_score) * 0.3 
             FROM competitor_aliases ca 
             WHERE ca.product_id = p.id 
             AND similarity(ca.competitor_name, query_text) > 0.3), 
            0
        )::DECIMAL as alias_score,
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
                ) +
                -- Training boost for partial matches
                COALESCE(
                    (SELECT MAX(mtd.match_confidence) * 0.1
                     FROM match_training_data mtd
                     WHERE mtd.matched_product_id = p.id
                     AND similarity(mtd.line_item_text, query_text) > 0.4),
                    0
                )
            ), 1.0
        )::DECIMAL as final_score,
        'algorithmic_enhanced'::TEXT as matched_via,
        ('⚡ ALGORITHMIC MATCHING with training boost - Name: ' || 
         ROUND((COALESCE(similarity(p.name, query_text), 0) * 100)::NUMERIC, 1) || 
         '%, SKU: ' || ROUND((COALESCE(similarity(p.sku, query_text), 0) * 100)::NUMERIC, 1) || '%')::TEXT as reasoning
    FROM products p
    WHERE (
        similarity(p.name, query_text) > 0.15 OR
        similarity(p.sku, query_text) > 0.15 OR
        levenshtein_less_equal(LOWER(p.name), normalized_query, 5) < 5 OR
        EXISTS (
            SELECT 1 FROM competitor_aliases ca 
            WHERE ca.product_id = p.id 
            AND similarity(ca.competitor_name, query_text) > 0.2
        )
    )
    ORDER BY (
        GREATEST(
            COALESCE(similarity(p.name, query_text), 0) * 0.5 +
            COALESCE(similarity(p.sku, query_text), 0) * 0.3 +
            COALESCE(
                (SELECT MAX(ca.confidence_score) * 0.2 
                 FROM competitor_aliases ca 
                 WHERE ca.product_id = p.id 
                 AND similarity(ca.competitor_name, query_text) > 0.2), 
                0
            ) +
            COALESCE(
                (SELECT MAX(mtd.match_confidence) * 0.1
                 FROM match_training_data mtd
                 WHERE mtd.matched_product_id = p.id
                 AND similarity(mtd.line_item_text, query_text) > 0.4),
                0
            )
        )
    ) DESC
    LIMIT limit_count;
    
    GET DIAGNOSTICS training_match_count = ROW_COUNT;
    
    -- If we found algorithmic matches, we're done
    IF training_match_count > 0 THEN
        RETURN;
    END IF;
    
    -- 🔄 TIER 4: FALLBACK FUZZY MATCHING
    -- Last resort - very relaxed matching for edge cases
    RETURN QUERY
    SELECT 
        p.id,
        p.sku,
        p.name,
        p.manufacturer,
        p.category,
        GREATEST(
            COALESCE(similarity(p.name, query_text), 0) * 0.7,
            COALESCE(similarity(p.sku, query_text), 0) * 0.5
        )::DECIMAL as vector_score,
        GREATEST(
            COALESCE(similarity(p.name, query_text), 0),
            COALESCE(similarity(p.sku, query_text), 0)
        )::DECIMAL as trigram_score,
        CASE WHEN levenshtein_less_equal(LOWER(p.name), normalized_query, 8) IS NOT NULL 
             THEN 1.0 - LEAST((levenshtein_less_equal(LOWER(p.name), normalized_query, 8)::DECIMAL / 8.0), 1.0)
             ELSE 0.0 END::DECIMAL as fuzzy_score,
        0.0::DECIMAL as alias_score,
        GREATEST(
            COALESCE(similarity(p.name, query_text), 0) * 0.6 +
            COALESCE(similarity(p.sku, query_text), 0) * 0.4,
            threshold
        )::DECIMAL as final_score,
        'fallback_fuzzy'::TEXT as matched_via,
        '🔄 FALLBACK MATCHING - Relaxed similarity for edge cases'::TEXT as reasoning
    FROM products p
    WHERE (
        similarity(p.name, query_text) > 0.1 OR
        similarity(p.sku, query_text) > 0.1 OR
        levenshtein_less_equal(LOWER(p.name), normalized_query, 8) < 8
    )
    AND NOT EXISTS (
        -- Don't return items we already found in previous tiers
        SELECT 1 FROM match_training_data mtd 
        WHERE mtd.matched_product_id = p.id
        AND mtd.line_item_normalized = normalized_query
    )
    ORDER BY (
        COALESCE(similarity(p.name, query_text), 0) * 0.6 +
        COALESCE(similarity(p.sku, query_text), 0) * 0.4
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
-- Allow all roles to execute the function

GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, DECIMAL) TO service_role;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, DECIMAL) TO anon;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- Test that the function exists and works

SELECT 'hybrid_product_match_tiered function deployed successfully' as status;

-- Test the function with a simple query
SELECT 'Function test:' as test_label, 
       COALESCE(COUNT(*), 0) as result_count 
FROM hybrid_product_match_tiered('test', 1, 0.1);