-- Deploy Sophisticated Tiered Matching System with Full Extension Support
-- Now that extensions are in public schema, we can use all the advanced functions

-- Drop any existing version
DROP FUNCTION IF EXISTS hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC);

-- Create helper function to get user's organization
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT organization_id INTO org_id
  FROM profiles 
  WHERE id = auth.uid();
  
  RETURN org_id;
END;
$$;

-- Main tiered matching function with full extension support
CREATE OR REPLACE FUNCTION hybrid_product_match_tiered(
  query_text TEXT,
  limit_count INTEGER DEFAULT 10,
  threshold NUMERIC DEFAULT 0.2
) 
RETURNS TABLE (
  product_id TEXT,        -- Matches TypeScript interface exactly
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

  -- Get user's organization
  org_id := get_user_org_id();
  IF org_id IS NULL THEN
    -- Fallback to a default org for testing
    org_id := '00000000-0000-0000-0000-000000000001';
  END IF;

  -- Set reasonable limits
  limit_count := COALESCE(limit_count, 10);
  limit_count := GREATEST(1, LEAST(limit_count, 50));
  threshold := COALESCE(threshold, 0.2);

  -- Normalize query using unaccent
  normalized_query := lower(trim(unaccent(query_text)));

  -- TIER 1: Exact training data matches (>= 0.95 similarity)
  -- Training data gets perfect scores and takes absolute priority
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
    1.0::NUMERIC as final_score,  -- Perfect score for exact training matches
    'training_exact'::TEXT as matched_via,
    TRUE as is_training_match
  FROM match_training_data mtd
  JOIN products p ON p.id::TEXT = mtd.matched_product_id
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
  JOIN products p ON p.id::TEXT = mtd.matched_product_id
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

  -- TIER 3: Algorithmic matching using products with all extension functions
  RETURN QUERY
  WITH candidate_matches AS (
    SELECT 
      p.id,
      p.sku,
      p.name,
      p.manufacturer,
      0.0 as vector_score,  -- Vector disabled per CONFIG
      -- Trigram score using pg_trgm similarity across all product fields
      GREATEST(
        similarity(unaccent(lower(p.name)), normalized_query),
        similarity(unaccent(lower(p.sku)), normalized_query),
        CASE WHEN p.manufacturer IS NOT NULL 
          THEN similarity(unaccent(lower(p.manufacturer)), normalized_query) 
          ELSE 0.0 
        END
      ) as trigram_score,
      -- Fuzzy score using Levenshtein distance
      GREATEST(
        GREATEST(0, 1.0 - (levenshtein(unaccent(lower(p.name)), normalized_query)::NUMERIC / GREATEST(length(p.name), length(normalized_query)))),
        GREATEST(0, 1.0 - (levenshtein(unaccent(lower(p.sku)), normalized_query)::NUMERIC / GREATEST(length(p.sku), length(normalized_query)))),
        CASE WHEN p.manufacturer IS NOT NULL 
          THEN GREATEST(0, 1.0 - (levenshtein(unaccent(lower(p.manufacturer)), normalized_query)::NUMERIC / GREATEST(length(p.manufacturer), length(normalized_query))))
          ELSE 0.0 
        END
      ) as fuzzy_score,
      -- Alias score from competitor_aliases using similarity
      COALESCE((
        SELECT MAX(ca.confidence_score * similarity(unaccent(lower(ca.competitor_name)), normalized_query))
        FROM competitor_aliases ca 
        WHERE ca.product_id::UUID = p.id
          AND ca.organization_id = org_id
          AND similarity(unaccent(lower(ca.competitor_name)), normalized_query) > 0.3
      ), 0.0) as alias_score
    FROM products p
    WHERE p.organization_id = org_id
  )
  SELECT 
    cm.id::TEXT as product_id,
    cm.sku,
    cm.name,
    cm.manufacturer,
    cm.vector_score::NUMERIC,
    cm.trigram_score::NUMERIC,
    cm.fuzzy_score::NUMERIC,
    cm.alias_score::NUMERIC,
    -- Final score using exact CONFIG weights from utils.ts
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

-- Grant permissions to all roles
GRANT EXECUTE ON FUNCTION get_user_org_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_org_id() TO anon;
GRANT EXECUTE ON FUNCTION get_user_org_id() TO authenticated;

GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO PUBLIC;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO authenticated;

-- Force PostgREST schema refresh
NOTIFY pgrst, 'reload schema';

-- Add comprehensive function comment
COMMENT ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) IS 'Sophisticated 3-tier product matching: (1) Exact training data matches get 1.0 scores, (2) Good training matches get 0.85-0.95 scores, (3) Algorithmic matching with pg_trgm similarity, Levenshtein fuzzy matching, and competitor aliases. Uses full PostgreSQL extensions for maximum accuracy.';

-- Test the function with extensions working
SELECT 'Testing tiered matching function with full extension support:' as test_status;

-- Test with a real product query
SELECT 
  product_id,
  sku,
  name,
  manufacturer,
  vector_score,
  trigram_score,
  fuzzy_score,
  alias_score,
  final_score,
  matched_via,
  is_training_match
FROM hybrid_product_match_tiered('power probe test kit', 5, 0.1);

SELECT 'Tiered matching function deployed successfully with full extension support!' as deployment_status;