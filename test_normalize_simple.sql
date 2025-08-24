-- Simple test function for normalize_product_text
CREATE OR REPLACE FUNCTION test_normalize_simple()
RETURNS TABLE (
  test_case INTEGER,
  input_text TEXT,
  expected_text TEXT,
  actual_text TEXT,
  passed BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Test case 1: Basic cleanup
  RETURN QUERY SELECT 
    1::INTEGER,
    '  BOLT - M16X1.50  '::TEXT,
    'bolt m16x1.50'::TEXT,
    normalize_product_text('  BOLT - M16X1.50  '),
    (normalize_product_text('  BOLT - M16X1.50  ') = 'bolt m16x1.50')::BOOLEAN;
  
  -- Test case 2: Abbreviation normalization  
  RETURN QUERY SELECT
    2::INTEGER,
    'Safety Glasses w/ 2.0 Diopter'::TEXT,
    'safety glasses with 2.0 diopter'::TEXT,
    normalize_product_text('Safety Glasses w/ 2.0 Diopter'),
    (normalize_product_text('Safety Glasses w/ 2.0 Diopter') = 'safety glasses with 2.0 diopter')::BOOLEAN;
    
  -- Test case 3: Hyphen handling
  RETURN QUERY SELECT
    3::INTEGER,
    'STEEL M8-1.25'::TEXT,
    'steel m8 1.25'::TEXT,
    normalize_product_text('STEEL M8-1.25'),
    (normalize_product_text('STEEL M8-1.25') = 'steel m8 1.25')::BOOLEAN;
    
  -- Test case 4: Real product example
  RETURN QUERY SELECT
    4::INTEGER,
    'MET 8.8 HX HD CAP SCR M16X1.50X30MM ZP'::TEXT,
    'met 8.8 hex head cap screw m16x1.50x30mm zinc plated'::TEXT,
    normalize_product_text('MET 8.8 HX HD CAP SCR M16X1.50X30MM ZP'),
    (normalize_product_text('MET 8.8 HX HD CAP SCR M16X1.50X30MM ZP') = 'met 8.8 hex head cap screw m16x1.50x30mm zinc plated')::BOOLEAN;
    
  -- Test case 5: Empty string
  RETURN QUERY SELECT
    5::INTEGER,
    ''::TEXT,
    ''::TEXT,
    normalize_product_text(''),
    (normalize_product_text('') = '')::BOOLEAN;
    
  -- Test case 6: NULL handling
  RETURN QUERY SELECT
    6::INTEGER,
    NULL::TEXT,
    ''::TEXT,
    normalize_product_text(NULL),
    (normalize_product_text(NULL) = '')::BOOLEAN;
END;
$$;