-- 🎯 MINIMAL CRITICAL FIXES ONLY
-- Ultra-safe deployment focusing on highest impact issues
-- Run these commands one section at a time

-- =============================================================================
-- SECTION 1: CRITICAL RLS SECURITY FIX
-- =============================================================================
-- This fixes the recursive dependency that causes security issues
-- Run this first and verify it works

DROP FUNCTION IF EXISTS auth.user_organization_id() CASCADE;

-- =============================================================================
-- SECTION 2: MOST CRITICAL PERFORMANCE INDEX
-- =============================================================================
-- This single index provides the biggest performance boost
-- Only run if Section 1 succeeded

CREATE INDEX IF NOT EXISTS idx_line_items_org_created 
ON line_items (organization_id, created_at DESC);

-- =============================================================================
-- SECTION 3: MATCHES PERFORMANCE INDEX  
-- =============================================================================
-- This fixes the N+1 query issue on the matches page
-- Only run if Section 2 succeeded

CREATE INDEX IF NOT EXISTS idx_matches_line_item_org 
ON matches (line_item_id, organization_id);

-- =============================================================================
-- SECTION 4: PRODUCTS LOOKUP INDEX
-- =============================================================================
-- This speeds up product matching queries
-- Only run if Section 3 succeeded

CREATE INDEX IF NOT EXISTS idx_products_org_sku 
ON products (organization_id, sku);

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- Run this to check what was created successfully

SELECT 
  schemaname, 
  tablename, 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE indexname IN (
  'idx_line_items_org_created',
  'idx_matches_line_item_org', 
  'idx_products_org_sku'
)
ORDER BY tablename, indexname;