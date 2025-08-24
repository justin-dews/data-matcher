-- Test function for normalize_product_text
CREATE OR REPLACE FUNCTION test_normalize_product_text()
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  test_results json;
  test_cases json[];
  result_case json;
  input_text TEXT;
  expected_output TEXT;
  actual_output TEXT;
  passed BOOLEAN;
BEGIN
  -- Define test cases
  test_cases := ARRAY[
    json_build_object(
      'input', '  BOLT - M16X1.50  ',
      'expected', 'bolt m16x1.50',
      'description', 'Basic cleanup and normalization'
    ),
    json_build_object(
      'input', 'Safety Glasses w/ 2.0 Diopter',
      'expected', 'safety glasses with 2.0 diopter',
      'description', 'Abbreviation normalization'
    ),
    json_build_object(
      'input', 'STEEL M8-1.25',
      'expected', 'steel m8 1.25',
      'description', 'Hyphen handling'
    ),
    json_build_object(
      'input', 'MET 8.8 HX HD CAP SCR M16X1.50X30MM ZP',
      'expected', 'met 8.8 hex head cap screw m16x1.50x30mm zinc plated',
      'description', 'Real product example from database'
    ),
    json_build_object(
      'input', 'BOLLHOFF PLUS NUT STEEL M8-1.25',
      'expected', 'bollhoff plus nut steel m8 1.25',
      'description', 'Another real product example'
    ),
    json_build_object(
      'input', '',
      'expected', '',
      'description', 'Empty string handling'
    ),
    json_build_object(
      'input', NULL,
      'expected', '',
      'description', 'NULL handling'
    )
  ];

  -- Initialize results array
  result_case := '[]'::json;

  -- Run each test case
  FOR i IN 1..array_length(test_cases, 1) LOOP
    input_text := test_cases[i]->>'input';
    expected_output := test_cases[i]->>'expected';
    
    -- Call the function
    actual_output := normalize_product_text(input_text);
    
    -- Check if test passed
    passed := (actual_output = expected_output);
    
    -- Add result to array
    result_case := result_case || json_build_object(
      'test_case', i,
      'description', test_cases[i]->>'description',
      'input', input_text,
      'expected', expected_output,
      'actual', actual_output,
      'passed', passed
    );
  END LOOP;

  test_results := json_build_object(
    'total_tests', array_length(test_cases, 1),
    'results', result_case
  );

  RETURN test_results;
END;
$$;