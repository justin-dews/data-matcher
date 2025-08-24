-- Fix: Remove hardcoded 0.1 threshold in hybrid_product_match function
-- This hardcoded threshold was preventing matches even when a lower threshold was passed

CREATE OR REPLACE FUNCTION hybrid_product_match(
  query_text TEXT,
  limit_count INTEGER DEFAULT 10,
  threshold DOUBLE PRECISION DEFAULT 0.4
) 
RETURNS TABLE (
  product_id UUID,
  sku TEXT,
  name TEXT,
  manufacturer TEXT,
  vector_score DOUBLE PRECISION,
  trigram_score DOUBLE PRECISION,
  alias_score DOUBLE PRECISION,
  final_score DOUBLE PRECISION,
  matched_via TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  normalized_query TEXT;
BEGIN
  -- Input validation
  IF query_text IS NULL OR trim(query_text) = '' THEN
    RETURN; -- Empty result set
  END IF;

  -- Normalize query text
  normalized_query := normalize_product_text(query_text);
  
  -- If normalization results in empty string, return empty
  IF normalized_query IS NULL OR trim(normalized_query) = '' THEN
    RETURN; -- Empty result set
  END IF;

  -- Set reasonable defaults and bounds
  limit_count := COALESCE(limit_count, 10);
  limit_count := GREATEST(1, LEAST(limit_count, 100)); -- Bound between 1-100
  
  threshold := COALESCE(threshold, 0.4);
  threshold := GREATEST(0.0, LEAST(threshold, 1.0)); -- Bound between 0-1

  -- Calculate a reasonable pre-filter threshold (lower than final threshold)
  -- This allows more candidates through for final scoring
  DECLARE
    prefilter_threshold DOUBLE PRECISION := GREATEST(threshold * 0.3, 0.05);
  BEGIN

  -- RLS will automatically filter products by user's organization
  RETURN QUERY
  WITH trigram_matches AS (
      SELECT 
          p.id,
          p.sku,
          p.name,
          p.manufacturer,
          0.0::DOUBLE PRECISION AS v_score,
          GREATEST(
              COALESCE(similarity(normalize_product_text(p.name), normalized_query), 0),
              COALESCE(similarity(p.sku, query_text), 0),
              COALESCE(similarity(p.manufacturer, query_text), 0)
          ) AS t_score,
          0.0::DOUBLE PRECISION AS a_score,
          'trigram' AS match_type
      FROM products p  -- RLS automatically filters by organization
      WHERE (
          similarity(normalize_product_text(p.name), normalized_query) > prefilter_threshold OR
          similarity(p.sku, query_text) > prefilter_threshold OR
          similarity(p.manufacturer, query_text) > prefilter_threshold
      )
  ),
  alias_matches AS (
      SELECT 
          p.id,
          p.sku,
          p.name,
          p.manufacturer,
          0.0::DOUBLE PRECISION AS v_score,
          0.0::DOUBLE PRECISION AS t_score,
          GREATEST(
              COALESCE(similarity(ca.competitor_name, query_text), 0),
              COALESCE(similarity(ca.competitor_sku, query_text), 0)
          ) * COALESCE(ca.confidence_score, 0.5) AS a_score,
          'alias' AS match_type
      FROM products p  -- RLS automatically filters by organization
      INNER JOIN competitor_aliases ca ON p.id = ca.product_id  -- RLS on aliases too
      WHERE (
          similarity(ca.competitor_name, query_text) > prefilter_threshold OR
          similarity(ca.competitor_sku, query_text) > prefilter_threshold
      )
  ),
  combined_matches AS (
      SELECT 
          id,
          sku,
          name,
          manufacturer,
          MAX(v_score) AS vector_score,
          MAX(t_score) AS trigram_score,
          MAX(a_score) AS alias_score,
          -- Weighted scoring: Trigram 60%, Alias 40% (no vector for now)
          (
              MAX(t_score) * 0.6 + 
              MAX(a_score) * 0.4
          ) AS final_score,
          array_to_string(
              array_agg(DISTINCT match_type ORDER BY match_type), 
              '+'
          ) AS matched_via
      FROM (
          SELECT * FROM trigram_matches
          UNION ALL
          SELECT * FROM alias_matches
      ) all_matches
      GROUP BY id, sku, name, manufacturer
      HAVING (
          MAX(t_score) * 0.6 + 
          MAX(a_score) * 0.4
      ) >= threshold  -- Use the passed threshold parameter
  )
  SELECT 
      cm.id,
      cm.sku,
      cm.name,
      cm.manufacturer,
      cm.vector_score,
      cm.trigram_score,
      cm.alias_score,
      cm.final_score,
      cm.matched_via
  FROM combined_matches cm
  ORDER BY cm.final_score DESC, cm.trigram_score DESC
  LIMIT limit_count;

  END;

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail completely
    RAISE NOTICE 'hybrid_product_match error: %', SQLERRM;
    RETURN; -- Empty result set
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION hybrid_product_match(TEXT, INTEGER, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_product_match(TEXT, INTEGER, DOUBLE PRECISION) TO service_role;

SELECT 'Fixed hybrid_product_match hardcoded threshold issue!' as status;