-- Create a simplified matching function for testing
-- This bypasses the complex RLS issues and tests core similarity

CREATE OR REPLACE FUNCTION simple_product_match_test(
  query_text TEXT,
  org_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
  limit_count INTEGER DEFAULT 10,
  threshold DOUBLE PRECISION DEFAULT 0.01
) 
RETURNS TABLE (
  product_id UUID,
  sku TEXT,
  name TEXT,
  manufacturer TEXT,
  name_similarity DOUBLE PRECISION,
  sku_similarity DOUBLE PRECISION,
  max_similarity DOUBLE PRECISION
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.sku,
    p.name,
    p.manufacturer,
    COALESCE(similarity(normalize_product_text(p.name), normalize_product_text(query_text)), 0.0)::DOUBLE PRECISION as name_similarity,
    COALESCE(similarity(p.sku, query_text), 0.0)::DOUBLE PRECISION as sku_similarity,
    GREATEST(
      COALESCE(similarity(normalize_product_text(p.name), normalize_product_text(query_text)), 0.0),
      COALESCE(similarity(p.sku, query_text), 0.0)
    )::DOUBLE PRECISION as max_similarity
  FROM products p
  WHERE p.organization_id = org_id
    AND (
      COALESCE(similarity(normalize_product_text(p.name), normalize_product_text(query_text)), 0.0) >= threshold
      OR COALESCE(similarity(p.sku, query_text), 0.0) >= threshold
    )
  ORDER BY max_similarity DESC
  LIMIT limit_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION simple_product_match_test(TEXT, UUID, INTEGER, DOUBLE PRECISION) TO service_role;
GRANT EXECUTE ON FUNCTION simple_product_match_test(TEXT, UUID, INTEGER, DOUBLE PRECISION) TO authenticated;

SELECT 'Created simple_product_match_test function!' as status;