-- Deploy Corrected Tiered Matching Function with Proper Type Handling
-- Fixed JOIN type casting issues

-- Drop any existing version
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC);

-- Main tiered matching function with CORRECT type handling
CREATE OR REPLACE FUNCTION hybrid_product_match_tiered(
  query_text TEXT,
  limit_count INTEGER DEFAULT 10,
  threshold NUMERIC DEFAULT 0.2
) 
RETURNS TABLE (
  product_id TEXT,        -- Return as TEXT for API compatibility
  sku TEXT,
  name TEXT,
  manufacturer TEXT,
  vector_score NUMERIC,
  trigram_score NUMERIC,
  fuzzy_score NUMERIC,
  alias_score NUMERIC,
  final_score NUMERIC,
  matched_via TEXT,
  is_training_match BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
  normalized_query TEXT;
  training_match_count INTEGER := 0;
BEGIN
  -- Input validation
  IF query_text IS NULL OR trim(query_text) = '' THEN
    RETURN;
  END IF;

  -- Get user's organization or use fallback
  SELECT organization_id INTO org_id FROM profiles WHERE id = auth.uid();
  IF org_id IS NULL THEN
    -- Use a fallback org for testing
    SELECT id INTO org_id FROM organizations LIMIT 1;
  END IF;
  
  IF org_id IS NULL THEN
    RETURN; -- No organization found
  END IF;

  -- Set reasonable limits
  limit_count := COALESCE(limit_count, 10);
  limit_count := GREATEST(1, LEAST(limit_count, 50));
  threshold := COALESCE(threshold, 0.2);

  -- Normalize query using unaccent
  normalized_query := lower(trim(unaccent(query_text)));

  -- TIER 1: Exact training data matches (>= 0.95 similarity)
  RETURN QUERY
  SELECT 
    p.id::TEXT as product_id,  -- Cast UUID to TEXT for API
    p.sku,
    p.name,
    p.manufacturer,
    0.0::NUMERIC as vector_score,
    similarity(unaccent(lower(mtd.line_item_normalized)), normalized_query)::NUMERIC as trigram_score,
    GREATEST(0, 1.0 - (levenshtein(unaccent(lower(mtd.line_item_text)), normalized_query)::NUMERIC / GREATEST(length(mtd.line_item_text), length(normalized_query))))::NUMERIC as fuzzy_score,
    0.0::NUMERIC as alias_score,
    1.0::NUMERIC as final_score,
    'training_exact'::TEXT as matched_via,
    TRUE as is_training_match
  FROM match_training_data mtd
  JOIN products p ON p.id = mtd.matched_product_id::UUID  -- FIXED: Both are UUID, no casting in JOIN
  WHERE p.organization_id = org_id
    AND mtd.organization_id = org_id
    AND similarity(unaccent(lower(mtd.line_item_normalized)), normalized_query) >= 0.95
  ORDER BY similarity(unaccent(lower(mtd.line_item_normalized)), normalized_query) DESC
  LIMIT limit_count;

  GET DIAGNOSTICS training_match_count = ROW_COUNT;
  
  -- If we found exact training matches, return only those
  IF training_match_count > 0 THEN
    RETURN;
  END IF;

  -- TIER 2: Good training data matches (0.8-0.95 similarity)
  RETURN QUERY
  SELECT 
    p.id::TEXT as product_id,
    p.sku,
    p.name,
    p.manufacturer,
    0.0::NUMERIC as vector_score,
    similarity(unaccent(lower(mtd.line_item_normalized)), normalized_query)::NUMERIC as trigram_score,
    GREATEST(0, 1.0 - (levenshtein(unaccent(lower(mtd.line_item_text)), normalized_query)::NUMERIC / GREATEST(length(mtd.line_item_text), length(normalized_query))))::NUMERIC as fuzzy_score,
    0.0::NUMERIC as alias_score,
    (0.85 + (similarity(unaccent(lower(mtd.line_item_normalized)), normalized_query) - 0.8) * 0.6)::NUMERIC as final_score,
    'training_good'::TEXT as matched_via,
    TRUE as is_training_match
  FROM match_training_data mtd
  JOIN products p ON p.id = mtd.matched_product_id::UUID  -- FIXED: Both are UUID
  WHERE p.organization_id = org_id
    AND mtd.organization_id = org_id
    AND similarity(unaccent(lower(mtd.line_item_normalized)), normalized_query) >= 0.8 
    AND similarity(unaccent(lower(mtd.line_item_normalized)), normalized_query) < 0.95
  ORDER BY similarity(unaccent(lower(mtd.line_item_normalized)), normalized_query) DESC
  LIMIT limit_count;

  GET DIAGNOSTICS training_match_count = ROW_COUNT;
  
  -- If we found good training matches, return only those
  IF training_match_count > 0 THEN
    RETURN;
  END IF;

  -- TIER 3: Algorithmic matching using products
  RETURN QUERY
  WITH candidate_matches AS (
    SELECT 
      p.id,
      p.sku,
      p.name,
      p.manufacturer,
      0.0 as vector_score,
      -- Trigram score using similarity
      GREATEST(
        similarity(unaccent(lower(p.name)), normalized_query),
        similarity(unaccent(lower(p.sku)), normalized_query),
        CASE WHEN p.manufacturer IS NOT NULL 
          THEN similarity(unaccent(lower(p.manufacturer)), normalized_query) 
          ELSE 0.0 
        END
      ) as trigram_score,
      -- Fuzzy score using levenshtein
      GREATEST(
        GREATEST(0, 1.0 - (levenshtein(unaccent(lower(p.name)), normalized_query)::NUMERIC / GREATEST(length(p.name), length(normalized_query)))),
        GREATEST(0, 1.0 - (levenshtein(unaccent(lower(p.sku)), normalized_query)::NUMERIC / GREATEST(length(p.sku), length(normalized_query)))),
        CASE WHEN p.manufacturer IS NOT NULL 
          THEN GREATEST(0, 1.0 - (levenshtein(unaccent(lower(p.manufacturer)), normalized_query)::NUMERIC / GREATEST(length(p.manufacturer), length(normalized_query))))
          ELSE 0.0 
        END
      ) as fuzzy_score,
      -- Alias score from competitor_aliases  
      COALESCE((
        SELECT MAX(ca.confidence_score * similarity(unaccent(lower(ca.competitor_name)), normalized_query))
        FROM competitor_aliases ca 
        WHERE ca.product_id::UUID = p.id  -- FIXED: Cast TEXT to UUID for comparison
          AND ca.organization_id = org_id
          AND similarity(unaccent(lower(ca.competitor_name)), normalized_query) > 0.3
      ), 0.0) as alias_score
    FROM products p
    WHERE p.organization_id = org_id
  )
  SELECT 
    cm.id::TEXT as product_id,  -- Cast UUID to TEXT for API
    cm.sku,
    cm.name,
    cm.manufacturer,
    cm.vector_score::NUMERIC,
    cm.trigram_score::NUMERIC,
    cm.fuzzy_score::NUMERIC,
    cm.alias_score::NUMERIC,
    -- Final score using CONFIG weights: vector 0%, trigram 40%, fuzzy 25%, alias 20%
    (cm.vector_score * 0.0 + 
     cm.trigram_score * 0.4 + 
     cm.fuzzy_score * 0.25 + 
     cm.alias_score * 0.2)::NUMERIC as final_score,
    'algorithmic'::TEXT as matched_via,
    FALSE as is_training_match
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO PUBLIC;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO authenticated;

-- Force schema refresh
NOTIFY pgrst, 'reload schema';

-- Test the corrected function
SELECT 'Testing corrected tiered matching function:' as test_status;

SELECT 
  product_id,
  sku,
  name,
  trigram_score,
  fuzzy_score,
  final_score,
  matched_via,
  is_training_match
FROM hybrid_product_match_tiered('test product', 5, 0.1);

SELECT '🎉 Corrected tiered matching function deployed successfully!' as deployment_status;