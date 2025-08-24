-- Complete Phase 1.2: Fix ALL remaining RLS policies (HOSTED SUPABASE VERSION)
-- Use inline queries that work with hosted Supabase permissions

-- 1. PRODUCTS TABLE - Fix recursive policies
DROP POLICY IF EXISTS "Users can manage products in their organization" ON products;
DROP POLICY IF EXISTS "Users can view products in their organization" ON products;
DROP POLICY IF EXISTS "products_org_access" ON products;
DROP POLICY IF EXISTS "products_service_role" ON products;

-- Use the same direct approach that worked for profiles
CREATE POLICY "products_user_access" ON products
    FOR ALL 
    TO authenticated
    USING ((SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL 
           AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK ((SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL 
                AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "products_service_role_access" ON products
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. MATCHES TABLE
DROP POLICY IF EXISTS "Users can manage matches in their organization" ON matches;
DROP POLICY IF EXISTS "Users can view matches in their organization" ON matches;
DROP POLICY IF EXISTS "matches_org_access" ON matches;
DROP POLICY IF EXISTS "matches_service_role" ON matches;

CREATE POLICY "matches_user_access" ON matches
    FOR ALL 
    TO authenticated
    USING ((SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL 
           AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK ((SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL 
                AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "matches_service_role_access" ON matches
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. DOCUMENTS TABLE
DROP POLICY IF EXISTS "Users can manage documents in their organization" ON documents;
DROP POLICY IF EXISTS "Users can view documents in their organization" ON documents;
DROP POLICY IF EXISTS "documents_org_access" ON documents;
DROP POLICY IF EXISTS "documents_service_role" ON documents;

CREATE POLICY "documents_user_access" ON documents
    FOR ALL 
    TO authenticated
    USING ((SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL 
           AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK ((SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL 
                AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "documents_service_role_access" ON documents
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. LINE_ITEMS TABLE
DROP POLICY IF EXISTS "Users can manage line items in their organization" ON line_items;
DROP POLICY IF EXISTS "Users can view line items in their organization" ON line_items;
DROP POLICY IF EXISTS "line_items_org_access" ON line_items;
DROP POLICY IF EXISTS "line_items_service_role" ON line_items;

CREATE POLICY "line_items_user_access" ON line_items
    FOR ALL 
    TO authenticated
    USING ((SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL 
           AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK ((SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL 
                AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "line_items_service_role_access" ON line_items
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5. ACTIVITY_LOG TABLE
DROP POLICY IF EXISTS "Users can view activity in their organization" ON activity_log;
DROP POLICY IF EXISTS "activity_log_org_insert" ON activity_log;
DROP POLICY IF EXISTS "activity_log_org_read" ON activity_log;
DROP POLICY IF EXISTS "activity_log_service_role" ON activity_log;

CREATE POLICY "activity_log_user_access" ON activity_log
    FOR ALL 
    TO authenticated
    USING ((SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL 
           AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK ((SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL 
                AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "activity_log_service_role_access" ON activity_log
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. COMPETITOR_ALIASES TABLE
DROP POLICY IF EXISTS "Users can manage aliases in their organization" ON competitor_aliases;
DROP POLICY IF EXISTS "Users can view aliases in their organization" ON competitor_aliases;
DROP POLICY IF EXISTS "competitor_aliases_org_access" ON competitor_aliases;
DROP POLICY IF EXISTS "competitor_aliases_service_role" ON competitor_aliases;

CREATE POLICY "competitor_aliases_user_access" ON competitor_aliases
    FOR ALL 
    TO authenticated
    USING ((SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL 
           AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK ((SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL 
                AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "competitor_aliases_service_role_access" ON competitor_aliases
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 7. PRODUCT_EMBEDDINGS TABLE - Special handling via products
DROP POLICY IF EXISTS "Users can view embeddings in their organization" ON product_embeddings;
DROP POLICY IF EXISTS "product_embeddings_org_access" ON product_embeddings;
DROP POLICY IF EXISTS "product_embeddings_service_role" ON product_embeddings;

CREATE POLICY "product_embeddings_user_access" ON product_embeddings
    FOR ALL 
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM products p 
        WHERE p.id = product_embeddings.product_id 
        AND (SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL
        AND p.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM products p 
        WHERE p.id = product_embeddings.product_id 
        AND (SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL
        AND p.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    ));

CREATE POLICY "product_embeddings_service_role_access" ON product_embeddings
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 8. ORGANIZATIONS TABLE - Users can only see their own organization
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "organizations_service_role" ON organizations;
DROP POLICY IF EXISTS "organizations_user_access" ON organizations;

CREATE POLICY "organizations_user_access" ON organizations
    FOR SELECT 
    TO authenticated
    USING ((SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL 
           AND id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "organizations_service_role_access" ON organizations
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 9. SETTINGS TABLE
DROP POLICY IF EXISTS "Users can manage settings in their organization" ON settings;
DROP POLICY IF EXISTS "Users can view settings in their organization" ON settings;
DROP POLICY IF EXISTS "settings_org_access" ON settings;
DROP POLICY IF EXISTS "settings_service_role" ON settings;

CREATE POLICY "settings_user_access" ON settings
    FOR ALL 
    TO authenticated
    USING ((SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL 
           AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK ((SELECT organization_id FROM profiles WHERE id = auth.uid()) IS NOT NULL 
                AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "settings_service_role_access" ON settings
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 10. Ensure RLS is enabled on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

SELECT 'Phase 1.2 Complete: All 10 tables now have working RLS policies!' as status;