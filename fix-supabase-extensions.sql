-- Supabase Extension Fix Script
-- Run this step by step to diagnose and fix extension issues

-- Step 1: Check current extension status
\echo '=== Step 1: Current Extension Status ==='
SELECT 
    name,
    installed_version,
    default_version,
    comment
FROM pg_available_extensions 
WHERE name IN ('pg_trgm', 'fuzzystrmatch', 'unaccent', 'vector')
ORDER BY name;

-- Step 2: Force install extensions with CASCADE and IF NOT EXISTS
\echo '=== Step 2: Installing Extensions ==='

-- Install pg_trgm (trigram matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm CASCADE;

-- Install fuzzystrmatch (Levenshtein distance)  
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch CASCADE;

-- Install unaccent (remove accents)
CREATE EXTENSION IF NOT EXISTS unaccent CASCADE;

-- Install vector (for embeddings) - may not be available in all Supabase instances
CREATE EXTENSION IF NOT EXISTS vector CASCADE;

-- Step 3: Verify functions are now available
\echo '=== Step 3: Testing Extension Functions ==='

-- Test pg_trgm functions
DO $$
BEGIN
    PERFORM similarity('test', 'testing');
    RAISE NOTICE 'pg_trgm similarity function: WORKING';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_trgm similarity function: FAILED - %', SQLERRM;
END
$$;

-- Test fuzzystrmatch functions
DO $$
BEGIN
    PERFORM levenshtein('test', 'testing');
    RAISE NOTICE 'fuzzystrmatch levenshtein function: WORKING';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'fuzzystrmatch levenshtein function: FAILED - %', SQLERRM;
END
$$;

-- Test unaccent function
DO $$
BEGIN
    PERFORM unaccent('café');
    RAISE NOTICE 'unaccent function: WORKING';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'unaccent function: FAILED - %', SQLERRM;
END
$$;

-- Step 4: Create a simplified matching function that doesn't rely on extensions
\echo '=== Step 4: Creating Fallback Matching Function ==='

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
AS $$
DECLARE
    normalized_query text;
    has_pg_trgm boolean := false;
    has_fuzzystrmatch boolean := false;
BEGIN
    -- Normalize input text
    normalized_query := lower(trim(query_text));
    
    -- Check if extensions are available
    BEGIN
        PERFORM similarity('test', 'test');
        has_pg_trgm := true;
    EXCEPTION
        WHEN OTHERS THEN
            has_pg_trgm := false;
    END;
    
    BEGIN
        PERFORM levenshtein('test', 'test');
        has_fuzzystrmatch := true;
    EXCEPTION
        WHEN OTHERS THEN
            has_fuzzystrmatch := false;
    END;

    -- Tier 1: Exact training data matches (95%+ similarity)
    RETURN QUERY
    SELECT 
        p.id::text as product_id,
        p.sku::text,
        p.name::text,
        p.manufacturer::text,
        0.0::numeric as vector_score,
        CASE 
            WHEN has_pg_trgm THEN similarity(td.line_item_normalized, normalized_query)
            ELSE 
                CASE 
                    WHEN td.line_item_normalized = normalized_query THEN 1.0
                    WHEN position(normalized_query in td.line_item_normalized) > 0 OR position(td.line_item_normalized in normalized_query) > 0 THEN 0.7
                    ELSE 0.0
                END
        END::numeric as trigram_score,
        CASE 
            WHEN has_fuzzystrmatch THEN 
                GREATEST(0, 1.0 - (levenshtein(td.line_item_normalized, normalized_query)::numeric / GREATEST(length(td.line_item_normalized), length(normalized_query))))
            ELSE 
                CASE 
                    WHEN td.line_item_normalized = normalized_query THEN 1.0
                    WHEN position(normalized_query in td.line_item_normalized) > 0 OR position(td.line_item_normalized in normalized_query) > 0 THEN 0.7
                    ELSE 0.0
                END
        END::numeric as fuzzy_score,
        0.0::numeric as alias_score,
        1.0::numeric as final_score,
        'training_exact'::text as matched_via,
        true as is_training_match
    FROM match_training_data td
    JOIN products p ON p.id = td.matched_product_id::uuid
    WHERE 
        CASE 
            WHEN has_pg_trgm THEN similarity(td.line_item_normalized, normalized_query) >= 0.95
            ELSE td.line_item_normalized = normalized_query
        END
    ORDER BY 
        CASE 
            WHEN has_pg_trgm THEN similarity(td.line_item_normalized, normalized_query) 
            ELSE 1.0 
        END DESC
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
        CASE 
            WHEN has_pg_trgm THEN similarity(td.line_item_normalized, normalized_query)
            ELSE 
                CASE 
                    WHEN position(normalized_query in td.line_item_normalized) > 0 OR position(td.line_item_normalized in normalized_query) > 0 THEN 0.8
                    ELSE 0.0
                END
        END::numeric as trigram_score,
        CASE 
            WHEN has_fuzzystrmatch THEN 
                GREATEST(0, 1.0 - (levenshtein(td.line_item_normalized, normalized_query)::numeric / GREATEST(length(td.line_item_normalized), length(normalized_query))))
            ELSE 
                CASE 
                    WHEN position(normalized_query in td.line_item_normalized) > 0 OR position(td.line_item_normalized in normalized_query) > 0 THEN 0.8
                    ELSE 0.0
                END
        END::numeric as fuzzy_score,
        0.0::numeric as alias_score,
        CASE 
            WHEN has_pg_trgm THEN 0.85 + (similarity(td.line_item_normalized, normalized_query) - 0.8) * 2.0
            ELSE 0.85
        END::numeric as final_score,
        'training_good'::text as matched_via,
        true as is_training_match
    FROM match_training_data td
    JOIN products p ON p.id = td.matched_product_id::uuid
    WHERE 
        CASE 
            WHEN has_pg_trgm THEN 
                similarity(td.line_item_normalized, normalized_query) >= 0.8 AND 
                similarity(td.line_item_normalized, normalized_query) < 0.95
            ELSE 
                position(normalized_query in td.line_item_normalized) > 0 OR 
                position(td.line_item_normalized in normalized_query) > 0
        END
    ORDER BY 
        CASE 
            WHEN has_pg_trgm THEN similarity(td.line_item_normalized, normalized_query) 
            ELSE 0.8 
        END DESC
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
            -- Trigram score
            CASE 
                WHEN has_pg_trgm THEN 
                    GREATEST(
                        similarity(lower(p.name), normalized_query),
                        similarity(lower(p.sku), normalized_query),
                        CASE WHEN p.manufacturer IS NOT NULL THEN similarity(lower(p.manufacturer), normalized_query) ELSE 0 END
                    )
                ELSE 
                    CASE 
                        WHEN position(normalized_query in lower(p.name)) > 0 OR position(lower(p.name) in normalized_query) > 0 THEN 0.6
                        WHEN position(normalized_query in lower(p.sku)) > 0 OR position(lower(p.sku) in normalized_query) > 0 THEN 0.7
                        ELSE 0.0
                    END
            END as trigram_score,
            -- Fuzzy score  
            CASE 
                WHEN has_fuzzystrmatch THEN
                    GREATEST(
                        GREATEST(0, 1.0 - (levenshtein(lower(p.name), normalized_query)::numeric / GREATEST(length(p.name), length(normalized_query)))),
                        GREATEST(0, 1.0 - (levenshtein(lower(p.sku), normalized_query)::numeric / GREATEST(length(p.sku), length(normalized_query)))),
                        CASE 
                            WHEN p.manufacturer IS NOT NULL THEN 
                                GREATEST(0, 1.0 - (levenshtein(lower(p.manufacturer), normalized_query)::numeric / GREATEST(length(p.manufacturer), length(normalized_query))))
                            ELSE 0 
                        END
                    )
                ELSE 
                    CASE 
                        WHEN position(normalized_query in lower(p.name)) > 0 OR position(lower(p.name) in normalized_query) > 0 THEN 0.5
                        WHEN position(normalized_query in lower(p.sku)) > 0 OR position(lower(p.sku) in normalized_query) > 0 THEN 0.6
                        ELSE 0.0
                    END
            END as fuzzy_score,
            -- Alias score from competitor_aliases
            COALESCE(MAX(ca.confidence_score), 0.0) as alias_score
        FROM products p
        LEFT JOIN competitor_aliases ca ON ca.product_id = p.id::text 
            AND (
                CASE 
                    WHEN has_pg_trgm THEN similarity(lower(ca.competitor_name), normalized_query) > 0.7
                    ELSE position(normalized_query in lower(ca.competitor_name)) > 0
                END
                OR 
                CASE 
                    WHEN ca.competitor_sku IS NOT NULL THEN
                        CASE 
                            WHEN has_pg_trgm THEN similarity(lower(ca.competitor_sku), normalized_query) > 0.7
                            ELSE position(normalized_query in lower(ca.competitor_sku)) > 0
                        END
                    ELSE false
                END
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
        -- Final score calculation (weights from CONFIG)
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

\echo '=== Step 5: Testing the Function ==='

-- Test the function with a sample query
SELECT * FROM hybrid_product_match_tiered('test product', 5, 0.1);

\echo '=== Setup Complete ==='
\echo 'If you see test results above, the function is working!'
\echo 'The function will use extensions if available, or fall back to basic string matching.'