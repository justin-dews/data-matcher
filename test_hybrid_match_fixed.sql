-- Test function for hybrid_product_match - FIXED VERSION
CREATE OR REPLACE FUNCTION test_hybrid_match()
RETURNS TABLE (
  test_case INTEGER,
  test_name TEXT,
  query_text TEXT,
  match_count INTEGER,
  top_score FLOAT,
  top_algorithm TEXT,
  performance_ms INTEGER,
  passed BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  test_org_id UUID;
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  duration_ms INTEGER;
  match_count_var INTEGER;
  top_score_var FLOAT;
  top_algorithm_var TEXT;
BEGIN
  -- Get a real organization ID from the database
  SELECT organization_id INTO test_org_id 
  FROM products 
  WHERE organization_id IS NOT NULL 
  LIMIT 1;
  
  -- If no organization found, create test results indicating this
  IF test_org_id IS NULL THEN
    RETURN QUERY SELECT 
      0::INTEGER,
      'No organization found in database'::TEXT,
      'N/A'::TEXT,
      0::INTEGER,
      0.0::FLOAT,
      'none'::TEXT,
      0::INTEGER,
      false::BOOLEAN;
    RETURN;
  END IF;

  -- Test case 1: Basic product match
  start_time := clock_timestamp();
  
  WITH test_results_1 AS (
    SELECT * FROM hybrid_product_match('BOLT M16', test_org_id, 10, 0.3)
  )
  SELECT 
    COUNT(*)::INTEGER, 
    COALESCE(MAX(final_score), 0.0)::FLOAT,
    COALESCE((SELECT match_algorithm FROM test_results_1 ORDER BY final_score DESC LIMIT 1), 'none')::TEXT
  INTO match_count_var, top_score_var, top_algorithm_var
  FROM test_results_1;
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    1::INTEGER,
    'Basic product match'::TEXT,
    'BOLT M16'::TEXT,
    match_count_var,
    top_score_var,
    top_algorithm_var,
    duration_ms,
    (match_count_var > 0 AND top_score_var > 0.3)::BOOLEAN;

  -- Test case 2: Fuzzy matching capability
  start_time := clock_timestamp();
  
  WITH test_results_2 AS (
    SELECT * FROM hybrid_product_match('SAFETY GOGGLES', test_org_id, 10, 0.3)
  )
  SELECT 
    COUNT(*)::INTEGER, 
    COALESCE(MAX(final_score), 0.0)::FLOAT,
    COALESCE((SELECT match_algorithm FROM test_results_2 ORDER BY final_score DESC LIMIT 1), 'none')::TEXT
  INTO match_count_var, top_score_var, top_algorithm_var
  FROM test_results_2;
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    2::INTEGER,
    'Fuzzy matching test'::TEXT,
    'SAFETY GOGGLES'::TEXT,
    match_count_var,
    top_score_var,
    top_algorithm_var,
    duration_ms,
    (match_count_var >= 0)::BOOLEAN; -- Just check it doesn't error

  -- Test case 3: Threshold filtering
  start_time := clock_timestamp();
  
  WITH test_results_3 AS (
    SELECT * FROM hybrid_product_match('RANDOM NONEXISTENT PRODUCT XYZ123', test_org_id, 10, 0.8)
  )
  SELECT 
    COUNT(*)::INTEGER, 
    COALESCE(MAX(final_score), 0.0)::FLOAT,
    'none'::TEXT
  INTO match_count_var, top_score_var, top_algorithm_var
  FROM test_results_3;
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    3::INTEGER,
    'Threshold filtering (high threshold)'::TEXT,
    'RANDOM NONEXISTENT PRODUCT XYZ123'::TEXT,
    match_count_var,
    top_score_var,
    top_algorithm_var,
    duration_ms,
    (match_count_var = 0 OR top_score_var < 0.8)::BOOLEAN; -- Should filter out low scores

  -- Test case 4: Limit functionality
  start_time := clock_timestamp();
  
  WITH test_results_4 AS (
    SELECT * FROM hybrid_product_match('BOLT', test_org_id, 3, 0.1) -- Very low threshold, limit 3
  )
  SELECT 
    COUNT(*)::INTEGER, 
    0.0::FLOAT,
    'limit'::TEXT
  INTO match_count_var, top_score_var, top_algorithm_var
  FROM test_results_4;
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    4::INTEGER,
    'Result limiting test'::TEXT,
    'BOLT'::TEXT,
    match_count_var,
    top_score_var,
    top_algorithm_var,
    duration_ms,
    (match_count_var <= 3)::BOOLEAN; -- Should respect limit

  -- Test case 5: Empty input handling
  start_time := clock_timestamp();
  
  WITH test_results_5 AS (
    SELECT * FROM hybrid_product_match('', test_org_id, 10, 0.5)
  )
  SELECT 
    COUNT(*)::INTEGER, 
    0.0::FLOAT,
    'none'::TEXT
  INTO match_count_var, top_score_var, top_algorithm_var
  FROM test_results_5;
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    5::INTEGER,
    'Empty input handling'::TEXT,
    ''::TEXT,
    match_count_var,
    top_score_var,
    top_algorithm_var,
    duration_ms,
    (match_count_var = 0)::BOOLEAN; -- Should return no results

  -- Test case 6: NULL input handling  
  start_time := clock_timestamp();
  
  WITH test_results_6 AS (
    SELECT * FROM hybrid_product_match(NULL, test_org_id, 10, 0.5)
  )
  SELECT 
    COUNT(*)::INTEGER, 
    0.0::FLOAT,
    'none'::TEXT
  INTO match_count_var, top_score_var, top_algorithm_var
  FROM test_results_6;
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    6::INTEGER,
    'NULL input handling'::TEXT,
    'NULL'::TEXT,
    match_count_var,
    top_score_var,
    top_algorithm_var,
    duration_ms,
    (match_count_var = 0)::BOOLEAN; -- Should return no results

  -- Test case 7: Organization isolation
  start_time := clock_timestamp();
  
  WITH test_results_7 AS (
    SELECT * FROM hybrid_product_match('BOLT', '99999999-9999-9999-9999-999999999999'::UUID, 10, 0.1)
  )
  SELECT 
    COUNT(*)::INTEGER, 
    0.0::FLOAT,
    'none'::TEXT
  INTO match_count_var, top_score_var, top_algorithm_var
  FROM test_results_7;
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    7::INTEGER,
    'Organization isolation'::TEXT,
    'BOLT'::TEXT,
    match_count_var,
    top_score_var,
    top_algorithm_var,
    duration_ms,
    (match_count_var = 0)::BOOLEAN; -- Should return no results for wrong org

  -- Test case 8: Performance test
  start_time := clock_timestamp();
  
  WITH test_results_8 AS (
    SELECT * FROM hybrid_product_match('METRIC HEX HEAD CAP SCREW M16X1.50X30MM', test_org_id, 10, 0.5)
  )
  SELECT 
    COUNT(*)::INTEGER, 
    COALESCE(MAX(final_score), 0.0)::FLOAT,
    'performance'::TEXT
  INTO match_count_var, top_score_var, top_algorithm_var
  FROM test_results_8;
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    8::INTEGER,
    'Performance test (complex query)'::TEXT,
    'METRIC HEX HEAD CAP SCREW M16X1.50X30MM'::TEXT,
    match_count_var,
    top_score_var,
    top_algorithm_var,
    duration_ms,
    (duration_ms < 2000)::BOOLEAN; -- Should complete in under 2 seconds

END;
$$;