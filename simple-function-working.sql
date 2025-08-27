-- Simple working function without unaccent
-- Focus on getting the function working first

-- Drop existing function
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(text, integer, numeric);

-- Create simple version without unaccent
CREATE OR REPLACE FUNCTION hybrid_product_match_tiered(
    query_text text,
    limit_count integer DEFAULT 10,
    threshold numeric DEFAULT 0.2
)
RETURNS TABLE(
    product_id text,
    sku text,
    name text,
    manufacturer text,
    vector_score numeric,
    trigram_score numeric,
    fuzzy_score numeric,
    alias_score numeric,
    final_score numeric,
    matched_via text,
    is_training_match boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    normalized_query text;
BEGIN
    -- Simple normalization without unaccent
    normalized_query := lower(trim(query_text));
    
    -- Tier 1: Exact training data matches (95%+ similarity)
    RETURN QUERY
    SELECT 
        p.id::text as product_id,
        p.sku::text,
        p.name::text,
        p.manufacturer::text,
        0.0::numeric as vector_score,
        similarity(lower(td.line_item_normalized), normalized_query)::numeric as trigram_score,
        GREATEST(0, 1.0 - (levenshtein(lower(td.line_item_normalized), normalized_query)::numeric / GREATEST(length(td.line_item_normalized), length(normalized_query))))::numeric as fuzzy_score,
        0.0::numeric as alias_score,
        1.0::numeric as final_score,
        'training_exact'::text as matched_via,
        true as is_training_match
    FROM match_training_data td
    JOIN products p ON p.id = td.matched_product_id::uuid
    WHERE similarity(lower(td.line_item_normalized), normalized_query) >= 0.95
    ORDER BY similarity(lower(td.line_item_normalized), normalized_query) DESC
    LIMIT limit_count;

    -- If we found exact matches, return them
    IF FOUND THEN
        RETURN;
    END IF;

    -- Tier 2: Good training data matches (80-95% similarity)  
    RETURN QUERY
    SELECT 
        p.id::text as product_id,
        p.sku::text,
        p.name::text,
        p.manufacturer::text,
        0.0::numeric as vector_score,
        similarity(lower(td.line_item_normalized), normalized_query)::numeric as trigram_score,
        GREATEST(0, 1.0 - (levenshtein(lower(td.line_item_normalized), normalized_query)::numeric / GREATEST(length(td.line_item_normalized), length(normalized_query))))::numeric as fuzzy_score,
        0.0::numeric as alias_score,
        (0.85 + (similarity(lower(td.line_item_normalized), normalized_query) - 0.8) * 2.0)::numeric as final_score,
        'training_good'::text as matched_via,
        true as is_training_match
    FROM match_training_data td
    JOIN products p ON p.id = td.matched_product_id::uuid
    WHERE similarity(lower(td.line_item_normalized), normalized_query) >= 0.8 
        AND similarity(lower(td.line_item_normalized), normalized_query) < 0.95
    ORDER BY similarity(lower(td.line_item_normalized), normalized_query) DESC
    LIMIT limit_count;

    -- If we found good training matches, return them
    IF FOUND THEN
        RETURN;
    END IF;

    -- Tier 3: Algorithmic matching using products table
    RETURN QUERY
    WITH candidate_matches AS (
        SELECT 
            p.id,
            p.sku,
            p.name,
            p.manufacturer,
            -- Vector score (disabled as per config)
            0.0 as vector_score,
            -- Trigram score - best match across name, sku, manufacturer
            GREATEST(
                similarity(lower(p.name), normalized_query),
                similarity(lower(p.sku), normalized_query),
                CASE WHEN p.manufacturer IS NOT NULL THEN similarity(lower(p.manufacturer), normalized_query) ELSE 0 END
            ) as trigram_score,
            -- Fuzzy score - best match across name, sku, manufacturer
            GREATEST(
                GREATEST(0, 1.0 - (levenshtein(lower(p.name), normalized_query)::numeric / GREATEST(length(p.name), length(normalized_query)))),
                GREATEST(0, 1.0 - (levenshtein(lower(p.sku), normalized_query)::numeric / GREATEST(length(p.sku), length(normalized_query)))),
                CASE 
                    WHEN p.manufacturer IS NOT NULL THEN 
                        GREATEST(0, 1.0 - (levenshtein(lower(p.manufacturer), normalized_query)::numeric / GREATEST(length(p.manufacturer), length(normalized_query))))
                    ELSE 0 
                END
            ) as fuzzy_score,
            -- Alias score from competitor_aliases
            COALESCE(MAX(ca.confidence_score), 0.0) as alias_score
        FROM products p
        LEFT JOIN competitor_aliases ca ON ca.product_id::uuid = p.id 
            AND (
                similarity(lower(ca.competitor_name), normalized_query) > 0.7
                OR 
                (ca.competitor_sku IS NOT NULL AND similarity(lower(ca.competitor_sku), normalized_query) > 0.7)
            )
        GROUP BY p.id, p.sku, p.name, p.manufacturer
    )
    SELECT 
        cm.id::text as product_id,
        cm.sku::text,
        cm.name::text,
        cm.manufacturer::text,
        cm.vector_score::numeric,
        cm.trigram_score::numeric,
        cm.fuzzy_score::numeric,
        cm.alias_score::numeric,
        -- Final score calculation (weights from CONFIG: trigram 0.4, fuzzy 0.25, alias 0.2)
        (cm.vector_score * 0.0 + 
         cm.trigram_score * 0.4 + 
         cm.fuzzy_score * 0.25 + 
         cm.alias_score * 0.2)::numeric as final_score,
        'algorithmic'::text as matched_via,
        false as is_training_match
    FROM candidate_matches cm
    WHERE (cm.vector_score * 0.0 + 
           cm.trigram_score * 0.4 + 
           cm.fuzzy_score * 0.25 + 
           cm.alias_score * 0.2) >= threshold
    ORDER BY (cm.vector_score * 0.0 + 
              cm.trigram_score * 0.4 + 
              cm.fuzzy_score * 0.25 + 
              cm.alias_score * 0.2) DESC
    LIMIT limit_count;

END;
$$;

-- Grant explicit permissions
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(text, integer, numeric) TO PUBLIC;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(text, integer, numeric) TO anon;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(text, integer, numeric) TO authenticated;

-- Add function comment
COMMENT ON FUNCTION hybrid_product_match_tiered(text, integer, numeric) IS 'Tiered product matching - simple working version';

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';

-- Test the function
SELECT 'Simple function created successfully' as status;
SELECT * FROM hybrid_product_match_tiered('test product', 3, 0.1) LIMIT 1;