-- Quick fix for hybrid function
DROP FUNCTION IF EXISTS hybrid_product_match;

CREATE OR REPLACE FUNCTION hybrid_product_match(
    query_text TEXT,
    query_embedding vector(1536),
    org_id UUID,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    product_id UUID,
    sku TEXT,
    name TEXT,
    manufacturer TEXT,
    final_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.sku,
        p.name,
        p.manufacturer,
        similarity(p.name, query_text)::DECIMAL AS score
    FROM products p
    WHERE p.organization_id = org_id
      AND similarity(p.name, query_text) > 0.1
    ORDER BY score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;