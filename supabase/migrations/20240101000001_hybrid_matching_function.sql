-- Hybrid matching function that combines vector similarity, trigram, and alias scoring
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
            p.id,
            p.sku,
            p.name,
            p.manufacturer,
            GREATEST(0, 1 - (pe.embedding <=> query_embedding))::DECIMAL(5,4) as vec_score,
            0::DECIMAL(5,4) as trig_score,
            0::DECIMAL(5,4) as alias_score,
            'vector' as match_type
        FROM products p
        INNER JOIN product_embeddings pe ON p.id = pe.product_id
        WHERE p.organization_id = org_id
        ORDER BY pe.embedding <=> query_embedding
        LIMIT limit_count * 2
    ),
    trigram_matches AS (
        SELECT 
            p.id,
            p.sku,
            p.name,
            p.manufacturer,
            0::DECIMAL(5,4) as vec_score,
            GREATEST(
                similarity(unaccent(lower(query_text)), unaccent(lower(p.name))),
                similarity(unaccent(lower(query_text)), unaccent(lower(p.sku))),
                CASE 
                    WHEN p.manufacturer IS NOT NULL THEN 
                        similarity(unaccent(lower(query_text)), unaccent(lower(p.manufacturer)))
                    ELSE 0 
                END
            )::DECIMAL(5,4) as trig_score,
            0::DECIMAL(5,4) as alias_score,
            'trigram' as match_type
        FROM products p
        WHERE p.organization_id = org_id
        AND (
            similarity(unaccent(lower(query_text)), unaccent(lower(p.name))) > 0.1
            OR similarity(unaccent(lower(query_text)), unaccent(lower(p.sku))) > 0.1
            OR (p.manufacturer IS NOT NULL AND similarity(unaccent(lower(query_text)), unaccent(lower(p.manufacturer))) > 0.1)
        )
        ORDER BY trig_score DESC
        LIMIT limit_count * 2
    ),
    alias_matches AS (
        SELECT 
            p.id,
            p.sku,
            p.name,
            p.manufacturer,
            0::DECIMAL(5,4) as vec_score,
            0::DECIMAL(5,4) as trig_score,
            ca.confidence_score::DECIMAL(5,4) as alias_score,
            'alias' as match_type
        FROM products p
        INNER JOIN competitor_aliases ca ON p.id = ca.product_id
        WHERE ca.organization_id = org_id
        AND (
            similarity(unaccent(lower(query_text)), unaccent(lower(ca.competitor_name))) > 0.7
            OR (ca.competitor_sku IS NOT NULL AND similarity(unaccent(lower(query_text)), unaccent(lower(ca.competitor_sku))) > 0.8)
            OR unaccent(lower(query_text)) ILIKE '%' || unaccent(lower(ca.competitor_name)) || '%'
        )
        ORDER BY alias_score DESC
        LIMIT limit_count
    ),
    combined_matches AS (
        SELECT * FROM vector_matches
        UNION ALL
        SELECT * FROM trigram_matches
        UNION ALL
        SELECT * FROM alias_matches
    ),
    aggregated_scores AS (
        SELECT 
            cm.id,
            cm.sku,
            cm.name,
            cm.manufacturer,
            MAX(cm.vec_score) as max_vector_score,
            MAX(cm.trig_score) as max_trigram_score,
            MAX(cm.alias_score) as max_alias_score,
            STRING_AGG(DISTINCT cm.match_type, '+' ORDER BY cm.match_type) as combined_match_type
        FROM combined_matches cm
        GROUP BY cm.id, cm.sku, cm.name, cm.manufacturer
    )
    SELECT 
        ag.id::UUID,
        ag.sku,
        ag.name,
        ag.manufacturer,
        ag.max_vector_score,
        ag.max_trigram_score,
        ag.max_alias_score,
        (
            ag.max_vector_score * vector_weight + 
            ag.max_trigram_score * trigram_weight + 
            ag.max_alias_score * alias_weight
        )::DECIMAL(5,4) as final_score,
        ag.combined_match_type
    FROM aggregated_scores ag
    WHERE (
        ag.max_vector_score * vector_weight + 
        ag.max_trigram_score * trigram_weight + 
        ag.max_alias_score * alias_weight
    ) > 0.1
    ORDER BY final_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to generate embeddings for products (to be called from Edge Functions)
CREATE OR REPLACE FUNCTION generate_product_embedding(
    product_id_param UUID,
    embedding_param vector(1536)
)
RETURNS UUID AS $$
DECLARE
    embedding_id UUID;
    product_text TEXT;
BEGIN
    -- Get the product text to store alongside the embedding
    SELECT CONCAT_WS(' ', name, sku, manufacturer, description) INTO product_text
    FROM products 
    WHERE id = product_id_param;
    
    -- Insert or update the embedding
    INSERT INTO product_embeddings (product_id, embedding, text_content)
    VALUES (product_id_param, embedding_param, product_text)
    ON CONFLICT (product_id) DO UPDATE SET
        embedding = embedding_param,
        text_content = product_text,
        created_at = NOW()
    RETURNING id INTO embedding_id;
    
    RETURN embedding_id;
END;
$$ LANGUAGE plpgsql;

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
    org_id UUID,
    user_id_param UUID,
    action_param TEXT,
    resource_type_param TEXT,
    resource_id_param UUID DEFAULT NULL,
    metadata_param JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO activity_log (organization_id, user_id, action, resource_type, resource_id, metadata)
    VALUES (org_id, user_id_param, action_param, resource_type_param, resource_id_param, metadata_param)
    RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create competitor alias from approved match
CREATE OR REPLACE FUNCTION create_competitor_alias(
    match_id_param UUID,
    user_id_param UUID
)
RETURNS UUID AS $$
DECLARE
    alias_id UUID;
    match_record RECORD;
    competitor_name_value TEXT;
BEGIN
    -- Get match details
    SELECT 
        m.organization_id,
        m.product_id,
        m.matched_text,
        li.parsed_data->>'name' as line_item_name,
        li.parsed_data->>'sku' as line_item_sku
    INTO match_record
    FROM matches m
    INNER JOIN line_items li ON m.line_item_id = li.id
    WHERE m.id = match_id_param;
    
    -- Use matched_text or fall back to line item name
    competitor_name_value := COALESCE(match_record.matched_text, match_record.line_item_name);
    
    -- Create alias if we have valid data
    IF competitor_name_value IS NOT NULL AND match_record.product_id IS NOT NULL THEN
        INSERT INTO competitor_aliases (
            organization_id,
            product_id,
            competitor_name,
            competitor_sku,
            created_by,
            confidence_score
        )
        VALUES (
            match_record.organization_id,
            match_record.product_id,
            competitor_name_value,
            match_record.line_item_sku,
            user_id_param,
            0.9
        )
        ON CONFLICT (organization_id, competitor_name, competitor_sku) DO UPDATE SET
            confidence_score = GREATEST(competitor_aliases.confidence_score, 0.9),
            created_by = user_id_param,
            approved_at = NOW()
        RETURNING id INTO alias_id;
    END IF;
    
    RETURN alias_id;
END;
$$ LANGUAGE plpgsql;