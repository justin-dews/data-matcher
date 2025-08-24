-- Test function for get_alias_boost
CREATE OR REPLACE FUNCTION test_alias_boost()
RETURNS TABLE (
  test_case INTEGER,
  scenario TEXT,
  competitor_text TEXT,
  expected_range TEXT,
  actual_score FLOAT,
  passed BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  test_org_id UUID := '11111111-1111-1111-1111-111111111111';
  test_product_id UUID := '22222222-2222-2222-2222-222222222222';
  test_alias_id UUID;
BEGIN
  -- Setup: Insert test alias record
  INSERT INTO competitor_aliases (
    id,
    organization_id,
    product_id,
    competitor_name,
    confidence_score,
    created_at
  ) VALUES (
    '33333333-3333-3333-3333-333333333333',
    test_org_id,
    test_product_id,
    'ACME BOLT M16X1.5',
    0.95,
    now()
  ) ON CONFLICT (id) DO UPDATE SET
    competitor_name = EXCLUDED.competitor_name,
    confidence_score = EXCLUDED.confidence_score;
  
  -- Test case 1: Exact alias match
  RETURN QUERY SELECT 
    1::INTEGER,
    'Exact alias match'::TEXT,
    'ACME BOLT M16X1.5'::TEXT,
    '0.95 (exact match)'::TEXT,
    get_alias_boost('ACME BOLT M16X1.5', test_product_id, test_org_id),
    (get_alias_boost('ACME BOLT M16X1.5', test_product_id, test_org_id) = 0.95)::BOOLEAN;
  
  -- Test case 2: Normalized exact match (different casing/spacing)
  RETURN QUERY SELECT
    2::INTEGER,
    'Normalized exact match'::TEXT,
    '  ACME  BOLT   M16X1.5  '::TEXT,
    '0.95 (normalized match)'::TEXT,
    get_alias_boost('  ACME  BOLT   M16X1.5  ', test_product_id, test_org_id),
    (get_alias_boost('  ACME  BOLT   M16X1.5  ', test_product_id, test_org_id) = 0.95)::BOOLEAN;
    
  -- Test case 3: High fuzzy similarity match
  RETURN QUERY SELECT
    3::INTEGER,
    'High fuzzy similarity'::TEXT,
    'ACME BOLT M16X1.50'::TEXT,
    '~0.76 (0.95 * fuzzy * 0.8)'::TEXT,
    get_alias_boost('ACME BOLT M16X1.50', test_product_id, test_org_id),
    (get_alias_boost('ACME BOLT M16X1.50', test_product_id, test_org_id) >= 0.70)::BOOLEAN;
    
  -- Test case 4: No alias match
  RETURN QUERY SELECT
    4::INTEGER,
    'No alias exists'::TEXT,
    'DIFFERENT PRODUCT'::TEXT,
    '0.0 (no match)'::TEXT,
    get_alias_boost('DIFFERENT PRODUCT', test_product_id, test_org_id),
    (get_alias_boost('DIFFERENT PRODUCT', test_product_id, test_org_id) = 0.0)::BOOLEAN;
    
  -- Test case 5: Wrong organization
  RETURN QUERY SELECT
    5::INTEGER,
    'Wrong organization'::TEXT,
    'ACME BOLT M16X1.5'::TEXT,
    '0.0 (wrong org)'::TEXT,
    get_alias_boost('ACME BOLT M16X1.5', test_product_id, '44444444-4444-4444-4444-444444444444'::UUID),
    (get_alias_boost('ACME BOLT M16X1.5', test_product_id, '44444444-4444-4444-4444-444444444444'::UUID) = 0.0)::BOOLEAN;
    
  -- Test case 6: Wrong product
  RETURN QUERY SELECT
    6::INTEGER,
    'Wrong product'::TEXT,
    'ACME BOLT M16X1.5'::TEXT,
    '0.0 (wrong product)'::TEXT,
    get_alias_boost('ACME BOLT M16X1.5', '55555555-5555-5555-5555-555555555555'::UUID, test_org_id),
    (get_alias_boost('ACME BOLT M16X1.5', '55555555-5555-5555-5555-555555555555'::UUID, test_org_id) = 0.0)::BOOLEAN;
    
  -- Test case 7: NULL handling
  RETURN QUERY SELECT
    7::INTEGER,
    'NULL input handling'::TEXT,
    NULL::TEXT,
    '0.0 (null input)'::TEXT,
    get_alias_boost(NULL, test_product_id, test_org_id),
    (get_alias_boost(NULL, test_product_id, test_org_id) = 0.0)::BOOLEAN;
    
  -- Test case 8: Empty string handling
  RETURN QUERY SELECT
    8::INTEGER,
    'Empty string handling'::TEXT,
    ''::TEXT,
    '0.0 (empty input)'::TEXT,
    get_alias_boost('', test_product_id, test_org_id),
    (get_alias_boost('', test_product_id, test_org_id) = 0.0)::BOOLEAN;
  
  -- Cleanup: Remove test data
  DELETE FROM competitor_aliases WHERE organization_id = test_org_id;
END;
$$;