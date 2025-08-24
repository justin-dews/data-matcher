-- Test function for hybrid_product_match
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
  test_org_id UUID := '11111111-1111-1111-1111-111111111111';
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  duration_ms INTEGER;
  result_record RECORD;
  match_count_var INTEGER;
  top_score_var FLOAT;
  top_algorithm_var TEXT;
BEGIN
  -- Test case 1: Basic product match
  start_time := clock_timestamp();
  
  SELECT COUNT(*), MAX(final_score), 
         (SELECT match_algorithm FROM hybrid_product_match('BOLT M16', test_org_id, 10, 0.3) 
          ORDER BY final_score DESC LIMIT 1)
  INTO match_count_var, top_score_var, top_algorithm_var
  FROM hybrid_product_match('BOLT M16', test_org_id, 10, 0.3);
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    1::INTEGER,
    'Basic product match'::TEXT,
    'BOLT M16'::TEXT,
    match_count_var,
    COALESCE(top_score_var, 0.0),
    COALESCE(top_algorithm_var, 'none'::TEXT),
    duration_ms,
    (match_count_var > 0 AND top_score_var > 0.3)::BOOLEAN;

  -- Test case 2: Fuzzy matching capability
  start_time := clock_timestamp();
  
  SELECT COUNT(*), MAX(final_score),
         (SELECT match_algorithm FROM hybrid_product_match('SAFETY GOGGLES', test_org_id, 10, 0.3)
          ORDER BY final_score DESC LIMIT 1)
  INTO match_count_var, top_score_var, top_algorithm_var
  FROM hybrid_product_match('SAFETY GOGGLES', test_org_id, 10, 0.3);
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    2::INTEGER,
    'Fuzzy matching test'::TEXT,
    'SAFETY GOGGLES'::TEXT,
    match_count_var,
    COALESCE(top_score_var, 0.0),
    COALESCE(top_algorithm_var, 'none'::TEXT),
    duration_ms,
    (match_count_var > 0)::BOOLEAN;

  -- Test case 3: Threshold filtering
  start_time := clock_timestamp();
  
  SELECT COUNT(*), MAX(final_score),
         (SELECT match_algorithm FROM hybrid_product_match('RANDOM NONEXISTENT PRODUCT XYZ123', test_org_id, 10, 0.8)
          ORDER BY final_score DESC LIMIT 1)
  INTO match_count_var, top_score_var, top_algorithm_var
  FROM hybrid_product_match('RANDOM NONEXISTENT PRODUCT XYZ123', test_org_id, 10, 0.8);
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    3::INTEGER,
    'Threshold filtering (high threshold)'::TEXT,
    'RANDOM NONEXISTENT PRODUCT XYZ123'::TEXT,
    match_count_var,
    COALESCE(top_score_var, 0.0),
    COALESCE(top_algorithm_var, 'none'::TEXT),
    duration_ms,
    (match_count_var = 0 OR top_score_var < 0.8)::BOOLEAN; -- Should filter out low scores

  -- Test case 4: Limit functionality
  start_time := clock_timestamp();
  
  SELECT COUNT(*)
  INTO match_count_var
  FROM hybrid_product_match('BOLT', test_org_id, 3, 0.1); -- Very low threshold, limit 3
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    4::INTEGER,
    'Result limiting test'::TEXT,
    'BOLT'::TEXT,
    match_count_var,
    0.0::FLOAT, -- Not relevant for this test
    'limit'::TEXT,
    duration_ms,
    (match_count_var <= 3)::BOOLEAN; -- Should respect limit

  -- Test case 5: Empty/null input handling
  start_time := clock_timestamp();
  
  SELECT COUNT(*)
  INTO match_count_var
  FROM hybrid_product_match('', test_org_id, 10, 0.5);
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    5::INTEGER,
    'Empty input handling'::TEXT,
    ''::TEXT,
    match_count_var,
    0.0::FLOAT,
    'none'::TEXT,
    duration_ms,
    (match_count_var = 0)::BOOLEAN; -- Should return no results

  -- Test case 6: Null input handling  
  start_time := clock_timestamp();
  
  SELECT COUNT(*)
  INTO match_count_var
  FROM hybrid_product_match(NULL, test_org_id, 10, 0.5);
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    6::INTEGER,
    'NULL input handling'::TEXT,
    'NULL'::TEXT,
    match_count_var,
    0.0::FLOAT,
    'none'::TEXT,
    duration_ms,
    (match_count_var = 0)::BOOLEAN; -- Should return no results

  -- Test case 7: Organization isolation
  start_time := clock_timestamp();
  
  SELECT COUNT(*)
  INTO match_count_var
  FROM hybrid_product_match('BOLT', '99999999-9999-9999-9999-999999999999'::UUID, 10, 0.1);
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    7::INTEGER,
    'Organization isolation'::TEXT,
    'BOLT'::TEXT,
    match_count_var,
    0.0::FLOAT,
    'none'::TEXT,
    duration_ms,
    (match_count_var = 0)::BOOLEAN; -- Should return no results for wrong org

  -- Test case 8: Performance test
  start_time := clock_timestamp();
  
  SELECT COUNT(*), MAX(final_score)
  INTO match_count_var, top_score_var
  FROM hybrid_product_match('METRIC HEX HEAD CAP SCREW M16X1.50X30MM', test_org_id, 10, 0.5);
  
  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECONDS FROM end_time - start_time)::INTEGER;
  
  RETURN QUERY SELECT 
    8::INTEGER,
    'Performance test (complex query)'::TEXT,
    'METRIC HEX HEAD CAP SCREW M16X1.50X30MM'::TEXT,
    match_count_var,
    COALESCE(top_score_var, 0.0),
    'performance'::TEXT,
    duration_ms,
    (duration_ms < 1000)::BOOLEAN; -- Should complete in under 1 second

END;
$$;