-- Fix the hybrid_product_match function with proper column aliases
CREATE OR REPLACE FUNCTION hybrid_product_match(
    query_text TEXT,
    query_embedding vector(1536),
    org_id UUID,
    limit_count INTEGER DEFAULT 10,
    vector_weight DECIMAL DEFAULT 0.6,
    trigram_weight DECIMAL DEFAULT 0.3,
    alias_weight DECIMAL DEFAULT 0.2
)
RETURNS TABLE (
    product_id UUID,
    sku TEXT,
    name TEXT,
    manufacturer TEXT,
    vector_score DECIMAL,
    trigram_score DECIMAL,
    alias_score DECIMAL,
    final_score DECIMAL,
    matched_via TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH vector_matches AS (
        SELECT 
            p.id AS p_id,
            p.sku AS p_sku,
            p.name AS p_name,
            p.manufacturer AS p_manufacturer,
            (1 - (pe.embedding <=> query_embedding)) AS v_score,
            0::DECIMAL AS t_score,
            0::DECIMAL AS a_score,
            'vector' AS match_type
        FROM products p
        INNER JOIN product_embeddings pe ON p.id = pe.product_id
        WHERE p.organization_id = org_id
    ),
    trigram_matches AS (
        SELECT 
            p.id AS p_id,
            p.sku AS p_sku,
            p.name AS p_name,
            p.manufacturer AS p_manufacturer,
            0::DECIMAL AS v_score,
            GREATEST(
                similarity(p.name, query_text),
                similarity(p.sku, query_text),
                COALESCE(similarity(p.manufacturer, query_text), 0)
            ) AS t_score,
            0::DECIMAL AS a_score,
            'trigram' AS match_type
        FROM products p
        WHERE p.organization_id = org_id
          AND (
              similarity(p.name, query_text) > 0.1 OR
              similarity(p.sku, query_text) > 0.1 OR
              similarity(p.manufacturer, query_text) > 0.1
          )
    ),
    alias_matches AS (
        SELECT 
            p.id AS p_id,
            p.sku AS p_sku,
            p.name AS p_name,
            p.manufacturer AS p_manufacturer,
            0::DECIMAL AS v_score,
            0::DECIMAL AS t_score,
            GREATEST(
                similarity(ca.competitor_name, query_text),
                COALESCE(similarity(ca.competitor_sku, query_text), 0)
            ) * ca.confidence_score AS a_score,
            'alias' AS match_type
        FROM products p
        INNER JOIN competitor_aliases ca ON p.id = ca.product_id
        WHERE p.organization_id = org_id
          AND (
              similarity(ca.competitor_name, query_text) > 0.1 OR
              similarity(ca.competitor_sku, query_text) > 0.1
          )
    ),
    combined_matches AS (
        SELECT 
            p_id,
            p_sku,
            p_name,
            p_manufacturer,
            MAX(v_score) AS vector_score,
            MAX(t_score) AS trigram_score,
            MAX(a_score) AS alias_score,
            (
                MAX(v_score) * vector_weight + 
                MAX(t_score) * trigram_weight + 
                MAX(a_score) * alias_weight
            ) AS final_score,
            array_to_string(
                array_agg(DISTINCT match_type ORDER BY match_type), 
                '+'
            ) AS matched_via
        FROM (
            SELECT * FROM vector_matches
            UNION ALL
            SELECT * FROM trigram_matches  
            UNION ALL
            SELECT * FROM alias_matches
        ) all_matches
        GROUP BY p_id, p_sku, p_name, p_manufacturer
        HAVING (
            MAX(v_score) * vector_weight + 
            MAX(t_score) * trigram_weight + 
            MAX(a_score) * alias_weight
        ) > 0.1
    )
    SELECT 
        cm.p_id,
        cm.p_sku,
        cm.p_name,
        cm.p_manufacturer,
        cm.vector_score,
        cm.trigram_score,
        cm.alias_score,
        cm.final_score,
        cm.matched_via
    FROM combined_matches cm
    ORDER BY cm.final_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;