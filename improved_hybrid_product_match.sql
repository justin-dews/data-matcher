-- Enhanced Hybrid Product Matching Function
-- Implements: Trigram (50%) + Fuzzy (30%) + Alias (20%) matching
-- No vector matching (removed as requested)

-- First, let's create a comprehensive fuzzy matching function
CREATE OR REPLACE FUNCTION calculate_fuzzy_score(
  text1 TEXT,
  text2 TEXT
) RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  lev_distance INTEGER;
  max_length INTEGER;
  normalized_score DOUBLE PRECISION;
BEGIN
  -- Handle null/empty inputs
  IF text1 IS NULL OR text2 IS NULL OR 
     trim(text1) = '' OR trim(text2) = '' THEN
    RETURN 0.0;
  END IF;
  
  -- Normalize inputs (lowercase, remove extra spaces)
  text1 := lower(trim(regexp_replace(text1, '\s+', ' ', 'g')));
  text2 := lower(trim(regexp_replace(text2, '\s+', ' ', 'g')));
  
  -- If exact match after normalization
  IF text1 = text2 THEN
    RETURN 1.0;
  END IF;
  
  -- Calculate Levenshtein distance
  lev_distance := levenshtein(text1, text2);
  max_length := GREATEST(length(text1), length(text2));
  
  -- Avoid division by zero
  IF max_length = 0 THEN
    RETURN 1.0;
  END IF;
  
  -- Convert distance to similarity score (1.0 = perfect match, 0.0 = no match)
  normalized_score := 1.0 - (lev_distance::DOUBLE PRECISION / max_length::DOUBLE PRECISION);
  
  -- Ensure score is between 0 and 1
  RETURN GREATEST(0.0, LEAST(1.0, normalized_score));
END;
$$;

-- Function to get alias boost score for a product
CREATE OR REPLACE FUNCTION get_alias_boost_score(
  p_product_id UUID,
  p_query_text TEXT,
  p_org_id UUID
) RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  best_alias_score DOUBLE PRECISION := 0.0;
  alias_record RECORD;
BEGIN
  -- Handle null inputs
  IF p_product_id IS NULL OR p_query_text IS NULL OR p_org_id IS NULL THEN
    RETURN 0.0;
  END IF;
  
  -- Check competitor aliases for this product
  FOR alias_record IN
    SELECT 
      ca.competitor_name,
      ca.competitor_sku,
      ca.confidence_score
    FROM competitor_aliases ca
    WHERE ca.product_id = p_product_id 
      AND ca.organization_id = p_org_id
  LOOP
    -- Check name match
    IF alias_record.competitor_name IS NOT NULL THEN
      best_alias_score := GREATEST(
        best_alias_score,
        -- Combine similarity with stored confidence
        (similarity(alias_record.competitor_name, p_query_text) + 
         COALESCE(alias_record.confidence_score, 0.5)) / 2.0
      );
    END IF;
    
    -- Check SKU match  
    IF alias_record.competitor_sku IS NOT NULL THEN
      best_alias_score := GREATEST(
        best_alias_score,
        -- Exact SKU matches get high score
        CASE 
          WHEN upper(trim(alias_record.competitor_sku)) = upper(trim(p_query_text)) THEN 0.95
          ELSE similarity(alias_record.competitor_sku, p_query_text)
        END
      );
    END IF;
  END LOOP;
  
  RETURN LEAST(1.0, best_alias_score);
END;
$$;

-- Main hybrid product matching function
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
  final_score DOUBLE PRECISION,
  matched_via TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_query TEXT;
  org_id UUID := '00000000-0000-0000-0000-000000000001';  -- Fixed org for now
  
  -- Scoring weights (must sum to 1.0)
  trigram_weight CONSTANT DOUBLE PRECISION := 0.5;  -- 50%
  fuzzy_weight CONSTANT DOUBLE PRECISION := 0.3;    -- 30% 
  alias_weight CONSTANT DOUBLE PRECISION := 0.2;    -- 20%
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

  -- Main matching query with hybrid scoring
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
    
    -- Final weighted score
    (
      (GREATEST(
        COALESCE(similarity(normalize_product_text(p.name), normalized_query), 0.0),
        COALESCE(similarity(p.sku, query_text), 0.0),
        COALESCE(similarity(COALESCE(p.manufacturer, ''), query_text), 0.0)
      ) * trigram_weight) +
      
      (GREATEST(
        calculate_fuzzy_score(p.name, query_text),
        calculate_fuzzy_score(p.sku, query_text),
        calculate_fuzzy_score(COALESCE(p.manufacturer, ''), query_text)
      ) * fuzzy_weight) +
      
      (get_alias_boost_score(p.id, query_text, org_id) * alias_weight)
    )::DOUBLE PRECISION as final_score,
    
    -- Determine primary matching method
    CASE 
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
      -- Must meet minimum threshold in at least one method
      COALESCE(similarity(normalize_product_text(p.name), normalized_query), 0.0) >= threshold
      OR COALESCE(similarity(p.sku, query_text), 0.0) >= threshold
      OR COALESCE(similarity(COALESCE(p.manufacturer, ''), query_text), 0.0) >= threshold
      OR calculate_fuzzy_score(p.name, query_text) >= threshold
      OR calculate_fuzzy_score(p.sku, query_text) >= threshold
      OR calculate_fuzzy_score(COALESCE(p.manufacturer, ''), query_text) >= threshold
      OR get_alias_boost_score(p.id, query_text, org_id) >= threshold
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
GRANT EXECUTE ON FUNCTION calculate_fuzzy_score(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_fuzzy_score(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION calculate_fuzzy_score(TEXT, TEXT) TO anon;

GRANT EXECUTE ON FUNCTION get_alias_boost_score(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_alias_boost_score(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_alias_boost_score(UUID, TEXT, UUID) TO anon;

GRANT EXECUTE ON FUNCTION hybrid_product_match(TEXT, INTEGER, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_product_match(TEXT, INTEGER, DOUBLE PRECISION) TO service_role;
GRANT EXECUTE ON FUNCTION hybrid_product_match(TEXT, INTEGER, DOUBLE PRECISION) TO anon;

SELECT 'Created enhanced hybrid_product_match with fuzzy and alias matching!' as status;