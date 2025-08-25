-- Enhanced Hybrid Product Matching Function with Machine Learning
-- Implements: Trigram (40%) + Fuzzy (25%) + Alias (20%) + Learned Similarity (15%)
-- This adds learned similarity as the 4th component for ML-enhanced matching

-- Update the hybrid matching function to include learned similarity
DROP FUNCTION IF EXISTS hybrid_product_match(text, integer, double precision);

CREATE OR REPLACE FUNCTION hybrid_product_match(
  query_text TEXT,
  limit_count INTEGER DEFAULT 10,
  threshold DOUBLE PRECISION DEFAULT 0.3
) 
RETURNS TABLE (
  product_id UUID,
  sku TEXT,
  name TEXT,
  manufacturer TEXT,
  vector_score DOUBLE PRECISION,
  trigram_score DOUBLE PRECISION,
  fuzzy_score DOUBLE PRECISION,
  alias_score DOUBLE PRECISION,
  learned_score DOUBLE PRECISION,  -- NEW: Added learned similarity score
  final_score DOUBLE PRECISION,
  matched_via TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_query TEXT;
  org_id UUID := '00000000-0000-0000-0000-000000000001';  -- Fixed org for now
  
  -- Updated scoring weights (must sum to 1.0)
  trigram_weight CONSTANT DOUBLE PRECISION := 0.4;   -- 40% (reduced from 50%)
  fuzzy_weight CONSTANT DOUBLE PRECISION := 0.25;    -- 25% (reduced from 30%)
  alias_weight CONSTANT DOUBLE PRECISION := 0.2;     -- 20% (same)
  learned_weight CONSTANT DOUBLE PRECISION := 0.15;  -- 15% (NEW)
BEGIN
  -- Input validation
  IF query_text IS NULL OR trim(query_text) = '' THEN
    RETURN; -- Empty result set
  END IF;

  -- Normalize query text
  SELECT normalize_product_text(query_text) INTO normalized_query;
  
  IF normalized_query IS NULL OR trim(normalized_query) = '' THEN
    normalized_query := lower(trim(query_text));
  END IF;

  -- Set reasonable defaults and bounds
  limit_count := COALESCE(limit_count, 10);
  limit_count := GREATEST(1, LEAST(limit_count, 100));
  
  threshold := COALESCE(threshold, 0.3);
  threshold := GREATEST(0.0, LEAST(threshold, 1.0));

  -- Main matching query with hybrid scoring including learned similarity
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.sku,
    p.name,
    p.manufacturer,
    
    -- Vector score (disabled, always 0.0)
    0.0::DOUBLE PRECISION as vector_score,
    
    -- Trigram score (best similarity across name, sku, manufacturer)
    GREATEST(
      COALESCE(similarity(normalize_product_text(p.name), normalized_query), 0.0),
      COALESCE(similarity(p.sku, query_text), 0.0),
      COALESCE(similarity(COALESCE(p.manufacturer, ''), query_text), 0.0)
    )::DOUBLE PRECISION as trigram_score,
    
    -- Fuzzy score (best fuzzy match across fields)
    GREATEST(
      calculate_fuzzy_score(p.name, query_text),
      calculate_fuzzy_score(p.sku, query_text),
      calculate_fuzzy_score(COALESCE(p.manufacturer, ''), query_text)
    )::DOUBLE PRECISION as fuzzy_score,
    
    -- Alias score (learned competitor mappings)
    get_alias_boost_score(p.id, query_text, org_id)::DOUBLE PRECISION as alias_score,
    
    -- NEW: Learned similarity score (ML-enhanced matching)
    get_learned_similarity_boost(query_text, p.id, org_id)::DOUBLE PRECISION as learned_score,
    
    -- Final weighted score (now includes learned similarity)
    (
      -- Trigram component (40%)
      (GREATEST(
        COALESCE(similarity(normalize_product_text(p.name), normalized_query), 0.0),
        COALESCE(similarity(p.sku, query_text), 0.0),
        COALESCE(similarity(COALESCE(p.manufacturer, ''), query_text), 0.0)
      ) * trigram_weight) +
      
      -- Fuzzy component (25%)
      (GREATEST(
        calculate_fuzzy_score(p.name, query_text),
        calculate_fuzzy_score(p.sku, query_text),
        calculate_fuzzy_score(COALESCE(p.manufacturer, ''), query_text)
      ) * fuzzy_weight) +
      
      -- Alias component (20%)
      (get_alias_boost_score(p.id, query_text, org_id) * alias_weight) +
      
      -- NEW: Learned similarity component (15%)
      (get_learned_similarity_boost(query_text, p.id, org_id) * learned_weight)
    )::DOUBLE PRECISION as final_score,
    
    -- Determine primary matching method (updated to include learned)
    CASE 
      WHEN get_learned_similarity_boost(query_text, p.id, org_id) > 0.6 THEN 'learned'
      WHEN get_alias_boost_score(p.id, query_text, org_id) > 0.7 THEN 'alias'
      WHEN GREATEST(
        calculate_fuzzy_score(p.name, query_text),
        calculate_fuzzy_score(p.sku, query_text),
        calculate_fuzzy_score(COALESCE(p.manufacturer, ''), query_text)
      ) > GREATEST(
        COALESCE(similarity(normalize_product_text(p.name), normalized_query), 0.0),
        COALESCE(similarity(p.sku, query_text), 0.0),
        COALESCE(similarity(COALESCE(p.manufacturer, ''), query_text), 0.0)
      ) THEN 'fuzzy'
      ELSE 'trigram'
    END::TEXT as matched_via
    
  FROM products p
  WHERE p.organization_id = org_id
    AND (
      -- Must meet minimum threshold in at least one method (including learned)
      COALESCE(similarity(normalize_product_text(p.name), normalized_query), 0.0) >= threshold
      OR COALESCE(similarity(p.sku, query_text), 0.0) >= threshold
      OR COALESCE(similarity(COALESCE(p.manufacturer, ''), query_text), 0.0) >= threshold
      OR calculate_fuzzy_score(p.name, query_text) >= threshold
      OR calculate_fuzzy_score(p.sku, query_text) >= threshold
      OR calculate_fuzzy_score(COALESCE(p.manufacturer, ''), query_text) >= threshold
      OR get_alias_boost_score(p.id, query_text, org_id) >= threshold
      OR get_learned_similarity_boost(query_text, p.id, org_id) >= threshold
    )
  ORDER BY final_score DESC, p.name ASC
  LIMIT limit_count;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'hybrid_product_match error: %', SQLERRM;
    RETURN; -- Empty result set
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION hybrid_product_match(TEXT, INTEGER, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_product_match(TEXT, INTEGER, DOUBLE PRECISION) TO service_role;
GRANT EXECUTE ON FUNCTION hybrid_product_match(TEXT, INTEGER, DOUBLE PRECISION) TO anon;

-- Update the CONFIG constants in utils.ts to reflect new weights
-- New weights: Trigram 40%, Fuzzy 25%, Alias 20%, Learned 15%

SELECT 'Enhanced hybrid_product_match with ML learned similarity (Trigram 40%, Fuzzy 25%, Alias 20%, Learned 15%)!' AS status;