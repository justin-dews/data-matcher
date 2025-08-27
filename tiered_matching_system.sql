-- Tiered Matching System: Training Data Takes Priority
-- This implements hierarchical matching where exact training matches trump algorithmic matches

-- Phase 1: Create exact training match detection function
CREATE OR REPLACE FUNCTION check_exact_training_match(
  p_query_text TEXT,
  p_org_id UUID
) RETURNS TABLE (
  product_id UUID,
  product_sku TEXT,
  product_name TEXT,
  training_similarity DOUBLE PRECISION,
  match_quality TEXT,
  is_exact_match BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  normalized_query TEXT;
BEGIN
  -- Handle null inputs
  IF p_query_text IS NULL OR p_org_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Normalize the input query  
  normalized_query := lower(trim(regexp_replace(p_query_text, '\s+', ' ', 'g')));
  
  -- Return matches from training data ordered by similarity
  RETURN QUERY
  SELECT 
    mtd.matched_product_id as product_id,
    mtd.product_sku,
    mtd.product_name,
    
    -- Calculate best similarity score across original and normalized text
    GREATEST(
      similarity(lower(trim(mtd.line_item_text)), normalized_query),
      similarity(mtd.line_item_normalized, normalized_query),
      calculate_fuzzy_score(mtd.line_item_text, p_query_text)
    )::DOUBLE PRECISION as training_similarity,
    
    mtd.match_quality::TEXT,
    
    -- Consider it an "exact match" if similarity > 0.95
    (GREATEST(
      similarity(lower(trim(mtd.line_item_text)), normalized_query),
      similarity(mtd.line_item_normalized, normalized_query),
      calculate_fuzzy_score(mtd.line_item_text, p_query_text)
    ) > 0.95)::BOOLEAN as is_exact_match
    
  FROM match_training_data mtd
  WHERE mtd.organization_id = p_org_id
    AND mtd.match_quality IN ('excellent', 'good') -- Only high-quality training data
    AND mtd.approved_at >= (now() - INTERVAL '12 months') -- Recent training data
    AND (
      -- Must have reasonable similarity to be considered
      similarity(lower(trim(mtd.line_item_text)), normalized_query) > 0.5
      OR similarity(mtd.line_item_normalized, normalized_query) > 0.5  
      OR calculate_fuzzy_score(mtd.line_item_text, p_query_text) > 0.5
    )
  ORDER BY training_similarity DESC
  LIMIT 5; -- Top 5 training matches
  
EXCEPTION
  WHEN OTHERS THEN
    -- Graceful degradation
    RETURN;
END;
$$;

-- Phase 2: Create the new tiered hybrid matching function
CREATE OR REPLACE FUNCTION hybrid_product_match_tiered(
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
  learned_score DOUBLE PRECISION,
  final_score DOUBLE PRECISION,
  matched_via TEXT,
  is_training_match BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  org_id UUID := '00000000-0000-0000-0000-000000000001';  -- Fixed org for now
  training_match RECORD;
  has_exact_match BOOLEAN := FALSE;
  has_good_match BOOLEAN := FALSE;
BEGIN
  -- Input validation
  IF query_text IS NULL OR trim(query_text) = '' THEN
    RETURN; -- Empty result set
  END IF;

  -- Set reasonable defaults
  limit_count := COALESCE(limit_count, 10);
  limit_count := GREATEST(1, LEAST(limit_count, 100));
  threshold := COALESCE(threshold, 0.3);

  -- TIER 1: Check for exact training matches (95%+ similarity)
  FOR training_match IN
    SELECT * FROM check_exact_training_match(query_text, org_id)
    WHERE training_similarity > 0.95
    ORDER BY training_similarity DESC
    LIMIT limit_count
  LOOP
    has_exact_match := TRUE;
    
    -- Get product details and return with score 1.0
    RETURN QUERY
    SELECT 
      p.id as product_id,
      p.sku,
      p.name,
      p.manufacturer,
      0.0::DOUBLE PRECISION as vector_score,
      training_match.training_similarity as trigram_score,
      training_match.training_similarity as fuzzy_score,
      0.0::DOUBLE PRECISION as alias_score,
      training_match.training_similarity as learned_score,
      1.0::DOUBLE PRECISION as final_score, -- EXACT MATCH = 1.0
      'training_exact'::TEXT as matched_via,
      TRUE::BOOLEAN as is_training_match
    FROM products p
    WHERE p.id = training_match.product_id
      AND p.organization_id = org_id;
  END LOOP;
  
  -- If we found exact matches, return only those
  IF has_exact_match THEN
    RETURN;
  END IF;

  -- TIER 2: Check for good training matches (80-95% similarity)
  FOR training_match IN
    SELECT * FROM check_exact_training_match(query_text, org_id)
    WHERE training_similarity BETWEEN 0.80 AND 0.95
    ORDER BY training_similarity DESC
    LIMIT limit_count
  LOOP
    has_good_match := TRUE;
    
    -- Get product details and return with high score
    RETURN QUERY
    SELECT 
      p.id as product_id,
      p.sku,
      p.name,
      p.manufacturer,
      0.0::DOUBLE PRECISION as vector_score,
      training_match.training_similarity as trigram_score,
      training_match.training_similarity as fuzzy_score,
      0.0::DOUBLE PRECISION as alias_score,
      training_match.training_similarity as learned_score,
      (0.85 + (training_match.training_similarity - 0.80) * 0.10 / 0.15)::DOUBLE PRECISION as final_score, -- Scale 0.85-0.95
      'training_good'::TEXT as matched_via,
      TRUE::BOOLEAN as is_training_match
    FROM products p
    WHERE p.id = training_match.product_id
      AND p.organization_id = org_id;
  END LOOP;
  
  -- If we found good training matches, return only those
  IF has_good_match THEN
    RETURN;
  END IF;

  -- TIER 3: Fall back to algorithmic matching (current system)
  -- This is the existing hybrid matching logic with training boost
  DECLARE
    normalized_query TEXT;
    trigram_weight CONSTANT DOUBLE PRECISION := 0.4;
    fuzzy_weight CONSTANT DOUBLE PRECISION := 0.3;
    alias_weight CONSTANT DOUBLE PRECISION := 0.2;  
    learned_weight CONSTANT DOUBLE PRECISION := 0.1; -- Reduced since we handle good training above
  BEGIN
    -- Normalize query text
    SELECT normalize_product_text(query_text) INTO normalized_query;
    IF normalized_query IS NULL OR trim(normalized_query) = '' THEN
      normalized_query := lower(trim(query_text));
    END IF;

    RETURN QUERY
    SELECT 
      p.id as product_id,
      p.sku,
      p.name,
      p.manufacturer,
      
      -- Vector score (disabled)
      0.0::DOUBLE PRECISION as vector_score,
      
      -- Trigram score
      GREATEST(
        COALESCE(similarity(normalize_product_text(p.name), normalized_query), 0.0),
        COALESCE(similarity(p.sku, query_text), 0.0),
        COALESCE(similarity(COALESCE(p.manufacturer, ''), query_text), 0.0)
      )::DOUBLE PRECISION as trigram_score,
      
      -- Fuzzy score
      GREATEST(
        calculate_fuzzy_score(p.name, query_text),
        calculate_fuzzy_score(p.sku, query_text),
        calculate_fuzzy_score(COALESCE(p.manufacturer, ''), query_text)
      )::DOUBLE PRECISION as fuzzy_score,
      
      -- Alias score
      get_alias_boost_score(p.id, query_text, org_id)::DOUBLE PRECISION as alias_score,
      
      -- Learned score (training data boost for partial matches)
      get_learned_similarity_boost(query_text, p.id, org_id)::DOUBLE PRECISION as learned_score,
      
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
        
        (get_alias_boost_score(p.id, query_text, org_id) * alias_weight) +
        (get_learned_similarity_boost(query_text, p.id, org_id) * learned_weight)
      )::DOUBLE PRECISION as final_score,
      
      -- Determine primary matching method
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
      END::TEXT as matched_via,
      
      FALSE::BOOLEAN as is_training_match
      
    FROM products p
    WHERE p.organization_id = org_id
      AND (
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
  END;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'hybrid_product_match_tiered error: %', SQLERRM;
    RETURN;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_exact_training_match(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_exact_training_match(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION check_exact_training_match(TEXT, UUID) TO anon;

GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, DOUBLE PRECISION) TO service_role;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, DOUBLE PRECISION) TO anon;

SELECT 'Created tiered matching system - training data now takes priority!' AS status;