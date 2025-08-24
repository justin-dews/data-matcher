-- PathoptMatch Database Setup Script (Safe Version)
-- This version checks for existing objects before creating them

-- ========================================
-- STEP 1: Enable Required Extensions
-- ========================================
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA extensions;

-- ========================================
-- STEP 2: Create Custom Types (Safe)
-- ========================================
DO $$ BEGIN
    CREATE TYPE match_status AS ENUM ('pending', 'approved', 'rejected', 'auto_matched');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE document_status AS ENUM ('uploading', 'parsing', 'parsed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ========================================
-- STEP 3: Create Missing Tables Only
-- ========================================

-- Product embeddings for vector similarity search
CREATE TABLE IF NOT EXISTS product_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    embedding vector(1536), -- OpenAI ada-002 embedding size
    text_content TEXT NOT NULL, -- The text that was embedded
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competitor aliases (learned mappings)
CREATE TABLE IF NOT EXISTS competitor_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    competitor_name TEXT NOT NULL,
    competitor_sku TEXT,
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    created_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, competitor_name, competitor_sku)
);

-- Settings table for configuration
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, key)
);

-- Activity log for audit trail
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- STEP 4: Create Missing Indexes
-- ========================================
CREATE INDEX IF NOT EXISTS idx_product_embeddings_product_id ON product_embeddings(product_id);
CREATE INDEX IF NOT EXISTS idx_product_embeddings_vector ON product_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_competitor_aliases_organization_id ON competitor_aliases(organization_id);
CREATE INDEX IF NOT EXISTS idx_competitor_aliases_product_id ON competitor_aliases(product_id);
CREATE INDEX IF NOT EXISTS idx_competitor_aliases_name_trgm ON competitor_aliases USING gin(competitor_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_activity_log_organization_id ON activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);

-- Trigram indexes for existing tables
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_manufacturer_trgm ON products USING gin(manufacturer gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_line_items_raw_text_trgm ON line_items USING gin(raw_text gin_trgm_ops);

-- ========================================
-- STEP 5: Enable RLS on New Tables
-- ========================================
ALTER TABLE product_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 6: Create Missing RLS Policies
-- ========================================

-- Product embeddings policies
DROP POLICY IF EXISTS "Users can view embeddings in their organization" ON product_embeddings;
CREATE POLICY "Users can view embeddings in their organization" ON product_embeddings
    FOR SELECT USING (
        product_id IN (
            SELECT p.id FROM products p
            INNER JOIN profiles pr ON p.organization_id = pr.organization_id
            WHERE pr.id = auth.uid()
        )
    );

-- Competitor aliases policies
DROP POLICY IF EXISTS "Users can view aliases in their organization" ON competitor_aliases;
CREATE POLICY "Users can view aliases in their organization" ON competitor_aliases
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can manage aliases in their organization" ON competitor_aliases;
CREATE POLICY "Users can manage aliases in their organization" ON competitor_aliases
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Settings policies
DROP POLICY IF EXISTS "Users can view settings in their organization" ON settings;
CREATE POLICY "Users can view settings in their organization" ON settings
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can manage settings in their organization" ON settings;
CREATE POLICY "Users can manage settings in their organization" ON settings
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Activity log policies
DROP POLICY IF EXISTS "Users can view activity in their organization" ON activity_log;
CREATE POLICY "Users can view activity in their organization" ON activity_log
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- ========================================
-- STEP 7: Create Hybrid Matching Function
-- ========================================
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
            p.id,
            p.sku,
            p.name,
            p.manufacturer,
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
            p.id,
            p.sku,
            p.name,
            p.manufacturer,
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
            id,
            sku,
            name,
            manufacturer,
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
        GROUP BY id, sku, name, manufacturer
        HAVING (
            MAX(v_score) * vector_weight + 
            MAX(t_score) * trigram_weight + 
            MAX(a_score) * alias_weight
        ) > 0.1
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
    ORDER BY cm.final_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 8: Test Query
-- ========================================
SELECT 'PathoptMatch database setup completed successfully!' as status;