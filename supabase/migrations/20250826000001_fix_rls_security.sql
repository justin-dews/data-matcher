-- Fix RLS Security Policies - Remove recursive dependencies and hardcoded values
-- This migration addresses critical security issues in RLS implementation

-- 1. Remove the problematic auth.user_organization_id() function that causes recursion
DROP FUNCTION IF EXISTS auth.user_organization_id();

-- 2. Fix profiles table RLS policies (foundation for all other policies)
-- Profiles must be accessible by their own user without recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create non-recursive profile policies
CREATE POLICY "profiles_own_access" ON profiles
    FOR ALL 
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Service role access for profiles
CREATE POLICY "profiles_service_role_access" ON profiles
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. Fix all other table policies to use direct profile lookup
-- This avoids the recursive function call issue

-- PRODUCTS TABLE
DROP POLICY IF EXISTS "products_user_access" ON products;
DROP POLICY IF EXISTS "products_service_role_access" ON products;
DROP POLICY IF EXISTS "Users can view products in their organization" ON products;
DROP POLICY IF EXISTS "Users can manage products in their organization" ON products;

CREATE POLICY "products_org_access" ON products
    FOR ALL 
    TO authenticated
    USING (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "products_service_role_access" ON products
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- DOCUMENTS TABLE  
DROP POLICY IF EXISTS "documents_user_access" ON documents;
DROP POLICY IF EXISTS "documents_service_role_access" ON documents;
DROP POLICY IF EXISTS "Users can view documents in their organization" ON documents;
DROP POLICY IF EXISTS "Users can manage documents in their organization" ON documents;

CREATE POLICY "documents_org_access" ON documents
    FOR ALL 
    TO authenticated
    USING (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "documents_service_role_access" ON documents
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- LINE_ITEMS TABLE
DROP POLICY IF EXISTS "line_items_user_access" ON line_items;
DROP POLICY IF EXISTS "line_items_service_role_access" ON line_items;
DROP POLICY IF EXISTS "Users can view line items in their organization" ON line_items;
DROP POLICY IF EXISTS "Users can manage line items in their organization" ON line_items;

CREATE POLICY "line_items_org_access" ON line_items
    FOR ALL 
    TO authenticated
    USING (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "line_items_service_role_access" ON line_items
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- MATCHES TABLE
DROP POLICY IF EXISTS "matches_user_access" ON matches;
DROP POLICY IF EXISTS "matches_service_role_access" ON matches;
DROP POLICY IF EXISTS "Users can view matches in their organization" ON matches;
DROP POLICY IF EXISTS "Users can manage matches in their organization" ON matches;

CREATE POLICY "matches_org_access" ON matches
    FOR ALL 
    TO authenticated
    USING (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "matches_service_role_access" ON matches
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- COMPETITOR_ALIASES TABLE
DROP POLICY IF EXISTS "competitor_aliases_user_access" ON competitor_aliases;
DROP POLICY IF EXISTS "competitor_aliases_service_role_access" ON competitor_aliases;
DROP POLICY IF EXISTS "Users can view aliases in their organization" ON competitor_aliases;
DROP POLICY IF EXISTS "Users can manage aliases in their organization" ON competitor_aliases;

CREATE POLICY "competitor_aliases_org_access" ON competitor_aliases
    FOR ALL 
    TO authenticated
    USING (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "competitor_aliases_service_role_access" ON competitor_aliases
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- MATCH_TRAINING_DATA TABLE
DROP POLICY IF EXISTS "match_training_data_user_access" ON match_training_data;
DROP POLICY IF EXISTS "match_training_data_service_role_access" ON match_training_data;

CREATE POLICY "match_training_data_org_access" ON match_training_data
    FOR ALL 
    TO authenticated
    USING (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "match_training_data_service_role_access" ON match_training_data
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- SETTINGS TABLE
DROP POLICY IF EXISTS "settings_user_access" ON settings;
DROP POLICY IF EXISTS "settings_service_role_access" ON settings;
DROP POLICY IF EXISTS "Users can view settings in their organization" ON settings;
DROP POLICY IF EXISTS "Users can manage settings in their organization" ON settings;

CREATE POLICY "settings_org_access" ON settings
    FOR ALL 
    TO authenticated
    USING (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "settings_service_role_access" ON settings
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ACTIVITY_LOG TABLE
DROP POLICY IF EXISTS "activity_log_user_access" ON activity_log;
DROP POLICY IF EXISTS "activity_log_service_role_access" ON activity_log;
DROP POLICY IF EXISTS "Users can view activity in their organization" ON activity_log;

CREATE POLICY "activity_log_org_access" ON activity_log
    FOR SELECT 
    TO authenticated
    USING (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "activity_log_insert_access" ON activity_log
    FOR INSERT 
    TO authenticated
    WITH CHECK (
        organization_id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "activity_log_service_role_access" ON activity_log
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ORGANIZATIONS TABLE
DROP POLICY IF EXISTS "organizations_user_access" ON organizations;
DROP POLICY IF EXISTS "organizations_service_role_access" ON organizations;

-- Users can only view their own organization
CREATE POLICY "organizations_own_access" ON organizations
    FOR SELECT 
    TO authenticated
    USING (
        id = (
            SELECT p.organization_id 
            FROM profiles p 
            WHERE p.id = auth.uid()
        )
    );

CREATE POLICY "organizations_service_role_access" ON organizations
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- PRODUCT_EMBEDDINGS TABLE (related to products)
DROP POLICY IF EXISTS "product_embeddings_user_access" ON product_embeddings;
DROP POLICY IF EXISTS "product_embeddings_service_role_access" ON product_embeddings;
DROP POLICY IF EXISTS "Users can view embeddings in their organization" ON product_embeddings;

CREATE POLICY "product_embeddings_org_access" ON product_embeddings
    FOR ALL 
    TO authenticated
    USING (
        product_id IN (
            SELECT prod.id 
            FROM products prod
            WHERE prod.organization_id = (
                SELECT p.organization_id 
                FROM profiles p 
                WHERE p.id = auth.uid()
            )
        )
    )
    WITH CHECK (
        product_id IN (
            SELECT prod.id 
            FROM products prod
            WHERE prod.organization_id = (
                SELECT p.organization_id 
                FROM profiles p 
                WHERE p.id = auth.uid()
            )
        )
    );

CREATE POLICY "product_embeddings_service_role_access" ON product_embeddings
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Add helpful comments to the migration
COMMENT ON POLICY "profiles_own_access" ON profiles IS 'Users can only access their own profile - prevents recursion';
COMMENT ON POLICY "products_org_access" ON products IS 'Users can access products in their organization via direct profile lookup';
COMMENT ON POLICY "documents_org_access" ON documents IS 'Users can access documents in their organization via direct profile lookup';
COMMENT ON POLICY "matches_org_access" ON matches IS 'Users can access matches in their organization via direct profile lookup';

-- Verify RLS is enabled on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_embeddings ENABLE ROW LEVEL SECURITY;