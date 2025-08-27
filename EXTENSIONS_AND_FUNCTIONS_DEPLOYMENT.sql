-- 🎯 COMPLETE DATABASE SETUP - EXTENSIONS + FUNCTIONS
-- This enables required extensions first, then deploys the hybrid matching function

-- =============================================================================
-- PHASE 1: ENABLE REQUIRED POSTGRESQL EXTENSIONS
-- =============================================================================
-- These extensions provide advanced text matching capabilities

-- Enable trigram matching (provides similarity() function)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable fuzzy string matching (provides levenshtein functions)
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Enable accent-insensitive matching 
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Enable vector similarity (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extensions are loaded
SELECT 'Extensions enabled:' as status, 
       extname as extension_name 
FROM pg_extension 
WHERE extname IN ('pg_trgm', 'fuzzystrmatch', 'unaccent', 'vector')
ORDER BY extname;

-- =============================================================================
-- PHASE 2: DEPLOY HYBRID MATCHING FUNCTION
-- =============================================================================
-- Now that extensions are enabled, we can use similarity() and levenshtein functions

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
    -- Now we can safely use similarity() and levenshtein functions
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
-- PHASE 3: GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, DECIMAL) TO service_role;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, DECIMAL) TO anon;

-- =============================================================================
-- PHASE 4: VERIFICATION
-- =============================================================================

SELECT 'Setup completed successfully!' as status;
SELECT 'Extensions:' as label, COUNT(*) as enabled_count 
FROM pg_extension 
WHERE extname IN ('pg_trgm', 'fuzzystrmatch', 'unaccent', 'vector');

-- Test the function
SELECT 'Function test:' as test_label, 
       COUNT(*) as result_count 
FROM hybrid_product_match_tiered('test', 1, 0.1);