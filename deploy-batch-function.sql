-- 🚀 DEPLOY BATCH FUNCTION FOR PERFORMANCE OPTIMIZATION
-- Deploy the missing hybrid_product_match_batch function

CREATE OR REPLACE FUNCTION hybrid_product_match_batch(
    query_texts TEXT[],
    limit_count INTEGER DEFAULT 5,
    threshold DECIMAL DEFAULT 0.2
) RETURNS TABLE (
    query_index INTEGER,
    query_text TEXT,
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
    reasoning TEXT,
    is_training_match BOOLEAN
) AS $$
DECLARE
    i INTEGER := 1;
    query_text TEXT;
BEGIN
    -- Process each query text in the array
    FOREACH query_text IN ARRAY query_texts LOOP
        RETURN QUERY
        SELECT 
            i as query_index,
            query_text as query_text,
            hm.product_id,
            hm.sku,
            hm.name,
            hm.manufacturer,
            hm.category,
            hm.vector_score,
            hm.trigram_score,
            hm.fuzzy_score,
            hm.alias_score,
            hm.final_score,
            hm.matched_via,
            hm.reasoning,
            CASE 
                WHEN hm.matched_via LIKE 'training_%' THEN true 
                ELSE false 
            END as is_training_match
        FROM hybrid_product_match_tiered(query_text, limit_count, threshold) AS hm;
        
        i := i + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
STABLE;

-- Grant permissions to all roles
GRANT EXECUTE ON FUNCTION hybrid_product_match_batch(TEXT[], INTEGER, DECIMAL) TO anon;
GRANT EXECUTE ON FUNCTION hybrid_product_match_batch(TEXT[], INTEGER, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_product_match_batch(TEXT[], INTEGER, DECIMAL) TO service_role;
GRANT EXECUTE ON FUNCTION hybrid_product_match_batch(TEXT[], INTEGER, DECIMAL) TO PUBLIC;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION hybrid_product_match_batch IS '🚀 BATCH HYBRID MATCHING: Process multiple queries efficiently to reduce function call overhead';

SELECT 'BATCH FUNCTION DEPLOYED SUCCESSFULLY' as status;