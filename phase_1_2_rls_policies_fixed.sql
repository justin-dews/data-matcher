-- PHASE 1.2: RLS POLICY DESIGN AND IMPLEMENTATION (FIXED VERSION)
-- 
-- Fixed for Supabase hosted environment - uses direct auth functions instead of custom auth schema functions

-- =============================================================================
-- STEP 1: DROP ALL EXISTING PROBLEMATIC POLICIES
-- =============================================================================

-- Drop all existing policies that might be blocking access
DROP POLICY IF EXISTS "organizations_own_org_access" ON organizations;
DROP POLICY IF EXISTS "organizations_service_role" ON organizations;

DROP POLICY IF EXISTS "profiles_org_access" ON profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON profiles;
DROP POLICY IF EXISTS "profiles_service_role" ON profiles;

DROP POLICY IF EXISTS "products_org_access" ON products;
DROP POLICY IF EXISTS "products_service_role" ON products;

DROP POLICY IF EXISTS "documents_org_access" ON documents;
DROP POLICY IF EXISTS "documents_service_role" ON documents;

DROP POLICY IF EXISTS "line_items_org_access" ON line_items;
DROP POLICY IF EXISTS "line_items_service_role" ON line_items;

DROP POLICY IF EXISTS "matches_org_access" ON matches;
DROP POLICY IF EXISTS "matches_service_role" ON matches;

DROP POLICY IF EXISTS "competitor_aliases_org_access" ON competitor_aliases;
DROP POLICY IF EXISTS "competitor_aliases_service_role" ON competitor_aliases;

DROP POLICY IF EXISTS "product_embeddings_org_access" ON product_embeddings;
DROP POLICY IF EXISTS "product_embeddings_service_role" ON product_embeddings;

DROP POLICY IF EXISTS "activity_log_org_read" ON activity_log;
DROP POLICY IF EXISTS "activity_log_org_insert" ON activity_log;
DROP POLICY IF EXISTS "activity_log_service_role" ON activity_log;

DROP POLICY IF EXISTS "settings_org_access" ON settings;
DROP POLICY IF EXISTS "settings_service_role" ON settings;

-- =============================================================================
-- STEP 2: IMPLEMENT FUNCTIONAL RLS POLICIES (SIMPLIFIED VERSION)
-- =============================================================================

-- ORGANIZATIONS TABLE
-- Users can see their own organization using direct profile lookup
CREATE POLICY "organizations_user_access" ON organizations
  FOR SELECT TO authenticated
  USING (id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Service role can manage all organizations
CREATE POLICY "organizations_service_role" ON organizations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- PROFILES TABLE  
-- Users can see profiles in their organization
CREATE POLICY "profiles_org_access" ON profiles
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Users can update their own profile
CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Service role can manage all profiles
CREATE POLICY "profiles_service_role" ON profiles
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- PRODUCTS TABLE (CRITICAL - This fixes the matches page!)
-- Users can access products in their organization
CREATE POLICY "products_org_access" ON products
  FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Service role can manage all products
CREATE POLICY "products_service_role" ON products
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- DOCUMENTS TABLE
-- Users can access documents in their organization
CREATE POLICY "documents_org_access" ON documents
  FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Service role can manage all documents
CREATE POLICY "documents_service_role" ON documents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- LINE_ITEMS TABLE (CRITICAL - This fixes line item access!)
-- Users can access line items in their organization
CREATE POLICY "line_items_org_access" ON line_items
  FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Service role can manage all line items
CREATE POLICY "line_items_service_role" ON line_items
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- MATCHES TABLE
-- Users can access matches in their organization
CREATE POLICY "matches_org_access" ON matches
  FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Service role can manage all matches
CREATE POLICY "matches_service_role" ON matches
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- COMPETITOR_ALIASES TABLE
-- Users can access competitor aliases in their organization
CREATE POLICY "competitor_aliases_org_access" ON competitor_aliases
  FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Service role can manage all competitor aliases
CREATE POLICY "competitor_aliases_service_role" ON competitor_aliases
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- PRODUCT_EMBEDDINGS TABLE
-- Users can access product embeddings for products in their organization
CREATE POLICY "product_embeddings_org_access" ON product_embeddings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products p 
    WHERE p.id = product_embeddings.product_id 
    AND p.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM products p 
    WHERE p.id = product_embeddings.product_id 
    AND p.organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  ));

-- Service role can manage all product embeddings
CREATE POLICY "product_embeddings_service_role" ON product_embeddings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ACTIVITY_LOG TABLE
-- Users can read activity logs for their organization
CREATE POLICY "activity_log_org_read" ON activity_log
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Users can insert activity logs for their organization
CREATE POLICY "activity_log_org_insert" ON activity_log
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Service role can manage all activity logs
CREATE POLICY "activity_log_service_role" ON activity_log
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- SETTINGS TABLE
-- Users can access settings for their organization
CREATE POLICY "settings_org_access" ON settings
  FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Service role can manage all settings
CREATE POLICY "settings_service_role" ON settings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- STEP 3: VERIFY RLS IS ENABLED ON ALL TABLES
-- =============================================================================

-- Ensure RLS is enabled on all tables (should already be done per audit)
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

-- =============================================================================
-- STEP 4: VERIFICATION
-- =============================================================================

-- Show all policies that were created
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename IN (
        'organizations', 'profiles', 'products', 'documents', 
        'line_items', 'matches', 'competitor_aliases', 
        'product_embeddings', 'activity_log', 'settings'
    )
ORDER BY tablename, policyname;

-- Test organization lookup for current user (if any authenticated)
SELECT 
    'Policy Test' as test_type,
    auth.uid() as current_user_id,
    (SELECT organization_id FROM profiles WHERE id = auth.uid()) as user_org_id,
    (SELECT COUNT(*) FROM products WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())) as accessible_products;

SELECT 'RLS Policy Implementation Complete!' as status,
       'Restart frontend and test matches page - should show 92 products' as next_step;