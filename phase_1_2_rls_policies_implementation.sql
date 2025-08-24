-- PHASE 1.2: RLS POLICY DESIGN AND IMPLEMENTATION
-- 
-- Based on Phase 1.1 audit findings:
-- - All tables have proper organization_id columns ✅
-- - All tables have RLS enabled ✅  
-- - Data exists and is properly organized ✅
-- - Missing: Functional RLS policies to allow user access ❌
--
-- This script creates the missing RLS policies to fix the matches page and hybrid_product_match function

-- =============================================================================
-- STEP 1: CREATE AUTHENTICATION HELPER FUNCTIONS
-- =============================================================================

-- Drop existing helper functions if they exist
DROP FUNCTION IF EXISTS auth.organization_id();
DROP FUNCTION IF EXISTS auth.user_role();

-- Create function to get user's organization ID from JWT token or profile
CREATE OR REPLACE FUNCTION auth.organization_id() 
RETURNS UUID AS $$
BEGIN
  -- Try to get organization_id from JWT claims first
  IF auth.jwt() IS NOT NULL AND auth.jwt() ->> 'organization_id' IS NOT NULL THEN
    RETURN (auth.jwt() ->> 'organization_id')::UUID;
  END IF;
  
  -- Fallback: Get from user profile
  IF auth.uid() IS NOT NULL THEN
    RETURN (
      SELECT organization_id 
      FROM profiles 
      WHERE id = auth.uid()
      LIMIT 1
    );
  END IF;
  
  -- No organization context available
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Create function to get user's role
CREATE OR REPLACE FUNCTION auth.user_role() 
RETURNS TEXT AS $$
BEGIN
  -- Try to get role from JWT claims first
  IF auth.jwt() IS NOT NULL AND auth.jwt() ->> 'role' IS NOT NULL THEN
    RETURN auth.jwt() ->> 'role';
  END IF;
  
  -- Fallback: Get from user profile  
  IF auth.uid() IS NOT NULL THEN
    RETURN (
      SELECT role 
      FROM profiles 
      WHERE id = auth.uid()
      LIMIT 1
    );
  END IF;
  
  -- Default role
  RETURN 'member';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Test the helper functions
SELECT 'Testing helper functions...' as status;

-- =============================================================================
-- STEP 2: DROP ALL EXISTING PROBLEMATIC POLICIES
-- =============================================================================

DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Get all existing policies on our tables
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND tablename IN (
            'organizations', 'profiles', 'products', 'documents', 
            'line_items', 'matches', 'competitor_aliases', 
            'product_embeddings', 'activity_log', 'settings'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            policy_record.policyname, 
            policy_record.schemaname, 
            policy_record.tablename
        );
        RAISE NOTICE 'Dropped policy: % on %', policy_record.policyname, policy_record.tablename;
    END LOOP;
END $$;

-- =============================================================================
-- STEP 3: IMPLEMENT COMPREHENSIVE RLS POLICIES
-- =============================================================================

-- ORGANIZATIONS TABLE
-- Users can see their own organization
CREATE POLICY "organizations_own_org_access" ON organizations
  FOR SELECT TO authenticated
  USING (id = auth.organization_id());

-- Service role can manage all organizations
CREATE POLICY "organizations_service_role" ON organizations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- PROFILES TABLE  
-- Users can see profiles in their organization
CREATE POLICY "profiles_org_access" ON profiles
  FOR SELECT TO authenticated
  USING (organization_id = auth.organization_id());

-- Users can update their own profile
CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND organization_id = auth.organization_id());

-- Service role can manage all profiles
CREATE POLICY "profiles_service_role" ON profiles
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- PRODUCTS TABLE (CRITICAL - This fixes the matches page!)
-- Users can access products in their organization
CREATE POLICY "products_org_access" ON products
  FOR ALL TO authenticated
  USING (organization_id = auth.organization_id())
  WITH CHECK (organization_id = auth.organization_id());

-- Service role can manage all products
CREATE POLICY "products_service_role" ON products
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- DOCUMENTS TABLE
-- Users can access documents in their organization
CREATE POLICY "documents_org_access" ON documents
  FOR ALL TO authenticated
  USING (organization_id = auth.organization_id())
  WITH CHECK (organization_id = auth.organization_id());

-- Service role can manage all documents
CREATE POLICY "documents_service_role" ON documents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- LINE_ITEMS TABLE (CRITICAL - This fixes line item access!)
-- Users can access line items in their organization
CREATE POLICY "line_items_org_access" ON line_items
  FOR ALL TO authenticated
  USING (organization_id = auth.organization_id())
  WITH CHECK (organization_id = auth.organization_id());

-- Service role can manage all line items
CREATE POLICY "line_items_service_role" ON line_items
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- MATCHES TABLE
-- Users can access matches in their organization
CREATE POLICY "matches_org_access" ON matches
  FOR ALL TO authenticated
  USING (organization_id = auth.organization_id())
  WITH CHECK (organization_id = auth.organization_id());

-- Service role can manage all matches
CREATE POLICY "matches_service_role" ON matches
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- COMPETITOR_ALIASES TABLE
-- Users can access competitor aliases in their organization
CREATE POLICY "competitor_aliases_org_access" ON competitor_aliases
  FOR ALL TO authenticated
  USING (organization_id = auth.organization_id())
  WITH CHECK (organization_id = auth.organization_id());

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
    AND p.organization_id = auth.organization_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM products p 
    WHERE p.id = product_embeddings.product_id 
    AND p.organization_id = auth.organization_id()
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
  USING (organization_id = auth.organization_id());

-- Users can insert activity logs for their organization
CREATE POLICY "activity_log_org_insert" ON activity_log
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth.organization_id());

-- Service role can manage all activity logs
CREATE POLICY "activity_log_service_role" ON activity_log
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- SETTINGS TABLE
-- Users can access settings for their organization
CREATE POLICY "settings_org_access" ON settings
  FOR ALL TO authenticated
  USING (organization_id = auth.organization_id())
  WITH CHECK (organization_id = auth.organization_id());

-- Service role can manage all settings
CREATE POLICY "settings_service_role" ON settings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- STEP 4: VERIFY RLS IS ENABLED ON ALL TABLES
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
-- STEP 5: VERIFICATION AND TESTING QUERIES
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

-- Test helper functions
SELECT 
    'Helper Function Test' as test_type,
    auth.organization_id() as org_id,
    auth.user_role() as user_role;

-- =============================================================================
-- EXPECTED RESULTS AFTER RUNNING THIS SCRIPT
-- =============================================================================

/*
IMMEDIATE EXPECTED FIXES:

1. ✅ Matches page will load and show 92 products (instead of 0)
2. ✅ hybrid_product_match function will return matching results  
3. ✅ Line items page will show 702 line items
4. ✅ Documents page will show 14 documents
5. ✅ Users can access their organization's data
6. ✅ Cross-organization data isolation maintained

BEFORE: 
- Frontend debug: "📦 Products table: 0 products found"
- Matches page: Loading spinner forever
- Console errors: "pldbgapi2 statement call stack is broken"

AFTER:
- Frontend debug: "📦 Products table: 92 products found" 
- Matches page: Shows product matching interface with real data
- Console: No RLS-related errors

VALIDATION TESTS:
Run the same audit script from Phase 1.1 and verify:
- Authenticated users can see their org's data
- Service role can see all data
- Anonymous users still blocked (security maintained)
*/

SELECT 'RLS Policy Implementation Complete!' as status,
       'Next: Test with authenticated user to verify matches page works' as next_step;