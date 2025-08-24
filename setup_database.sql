-- PathoptMatch Database Setup Script
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/theattidfeqxyaexiqwj/sql

-- ========================================
-- STEP 1: Enable Required Extensions
-- ========================================
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA extensions;

-- ========================================
-- STEP 2: Create Custom Types
-- ========================================
CREATE TYPE match_status AS ENUM ('pending', 'approved', 'rejected', 'auto_matched');
CREATE TYPE document_status AS ENUM ('uploading', 'parsing', 'parsed', 'failed');

-- ========================================
-- STEP 3: Create Core Tables
-- ========================================

-- Organizations table (multi-tenant support)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table (internal catalog)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    manufacturer TEXT,
    price DECIMAL(10,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, sku)
);

-- Product embeddings for vector similarity search
CREATE TABLE product_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    embedding vector(1536), -- OpenAI ada-002 embedding size
    text_content TEXT NOT NULL, -- The text that was embedded
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table (uploaded PDFs)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_size INTEGER,
    file_path TEXT NOT NULL,
    status document_status DEFAULT 'uploading',
    parse_job_id TEXT, -- LlamaParse job ID
    parse_result JSONB, -- Structured data from LlamaParse
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Line items extracted from documents
CREATE TABLE line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    line_number INTEGER,
    raw_text TEXT NOT NULL,
    parsed_data JSONB, -- Structured fields (name, quantity, price, etc.)
    quantity DECIMAL(10,3),
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competitor aliases (learned mappings)
CREATE TABLE competitor_aliases (
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

-- Matches table (decisions and scores)
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_item_id UUID NOT NULL REFERENCES line_items(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status match_status DEFAULT 'pending',
    confidence_score DECIMAL(3,2),
    vector_score DECIMAL(3,2),
    trigram_score DECIMAL(3,2),
    alias_score DECIMAL(3,2),
    final_score DECIMAL(3,2),
    matched_text TEXT,
    reasoning TEXT,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings table for configuration
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, key)
);

-- Activity log for audit trail
CREATE TABLE activity_log (
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
-- STEP 4: Create Performance Indexes
-- ========================================
CREATE INDEX idx_products_organization_id ON products(organization_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_products_manufacturer_trgm ON products USING gin(manufacturer gin_trgm_ops);

CREATE INDEX idx_product_embeddings_product_id ON product_embeddings(product_id);
CREATE INDEX idx_product_embeddings_vector ON product_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_documents_organization_id ON documents(organization_id);
CREATE INDEX idx_documents_status ON documents(status);

CREATE INDEX idx_line_items_document_id ON line_items(document_id);
CREATE INDEX idx_line_items_organization_id ON line_items(organization_id);
CREATE INDEX idx_line_items_raw_text_trgm ON line_items USING gin(raw_text gin_trgm_ops);

CREATE INDEX idx_competitor_aliases_organization_id ON competitor_aliases(organization_id);
CREATE INDEX idx_competitor_aliases_product_id ON competitor_aliases(product_id);
CREATE INDEX idx_competitor_aliases_name_trgm ON competitor_aliases USING gin(competitor_name gin_trgm_ops);

CREATE INDEX idx_matches_line_item_id ON matches(line_item_id);
CREATE INDEX idx_matches_product_id ON matches(product_id);
CREATE INDEX idx_matches_organization_id ON matches(organization_id);
CREATE INDEX idx_matches_status ON matches(status);

CREATE INDEX idx_activity_log_organization_id ON activity_log(organization_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);

-- ========================================
-- STEP 5: Enable Row Level Security
-- ========================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 6: Create RLS Policies
-- ========================================

-- Organizations policies
CREATE POLICY "Users can view their organization" ON organizations
    FOR SELECT USING (
        id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Profiles policies
CREATE POLICY "Users can view profiles in their organization" ON profiles
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (id = auth.uid());

-- Products policies
CREATE POLICY "Users can view products in their organization" ON products
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage products in their organization" ON products
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Product embeddings policies
CREATE POLICY "Users can view embeddings in their organization" ON product_embeddings
    FOR SELECT USING (
        product_id IN (
            SELECT p.id FROM products p
            INNER JOIN profiles pr ON p.organization_id = pr.organization_id
            WHERE pr.id = auth.uid()
        )
    );

-- Documents policies
CREATE POLICY "Users can view documents in their organization" ON documents
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage documents in their organization" ON documents
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Line items policies
CREATE POLICY "Users can view line items in their organization" ON line_items
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage line items in their organization" ON line_items
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Competitor aliases policies
CREATE POLICY "Users can view aliases in their organization" ON competitor_aliases
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage aliases in their organization" ON competitor_aliases
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Matches policies
CREATE POLICY "Users can view matches in their organization" ON matches
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage matches in their organization" ON matches
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Settings policies
CREATE POLICY "Users can view settings in their organization" ON settings
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can manage settings in their organization" ON settings
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Activity log policies
CREATE POLICY "Users can view activity in their organization" ON activity_log
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    );

-- ========================================
-- STEP 7: Create Triggers for updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- STEP 8: Create Hybrid Matching Function
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
-- SUCCESS MESSAGE
-- ========================================
-- If you see this message, the PathoptMatch database is fully set up!
-- Next steps:
-- 1. Create a storage bucket called "documents" in Supabase Storage
-- 2. Test the connection from your Next.js app
-- 3. Start building the core features!