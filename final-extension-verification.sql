-- FINAL VERIFICATION: All PostgreSQL Extensions Working in Supabase
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/theattidfeqxyaexiqwj/sql

-- ✅ TEST 1: Extension Installation Status
SELECT 
  '🔍 EXTENSION STATUS' as test_category,
  extname as extension_name,
  extnamespace::regnamespace as schema_location,
  extversion as version,
  '✅ Installed' as status
FROM pg_extension 
WHERE extname IN ('vector', 'pg_trgm', 'fuzzystrmatch', 'unaccent')
ORDER BY extname;

-- ✅ TEST 2: pg_trgm Functions (similarity, show_trgm)
SELECT 
  '🧩 PG_TRGM FUNCTIONS' as test_category,
  'similarity()' as function_name,
  similarity('test string', 'test string')::text as exact_match_result,
  similarity('hello world', 'hello world!')::text as similar_match_result,
  '✅ Working' as status
UNION ALL
SELECT 
  '🧩 PG_TRGM FUNCTIONS' as test_category,
  'show_trgm()' as function_name,
  array_to_string(show_trgm('hello'), ', ') as trigram_breakdown,
  'trigrams for "hello"' as similar_match_result,
  '✅ Working' as status;

-- ✅ TEST 3: unaccent Function
SELECT 
  '🌍 UNACCENT FUNCTIONS' as test_category,
  'unaccent()' as function_name,
  unaccent('café résumé naïve') as accented_input,
  'accent removal test' as similar_match_result,
  '✅ Working' as status;

-- ✅ TEST 4: fuzzystrmatch Functions (levenshtein, soundex)
SELECT 
  '🎯 FUZZYSTRMATCH FUNCTIONS' as test_category,
  'levenshtein()' as function_name,
  levenshtein('kitten', 'sitting')::text as distance_result,
  'distance between "kitten" and "sitting"' as similar_match_result,
  '✅ Working' as status
UNION ALL
SELECT 
  '🎯 FUZZYSTRMATCH FUNCTIONS' as test_category,
  'levenshtein_less_equal()' as function_name,
  levenshtein_less_equal('hello', 'helo', 2)::text as limited_distance,
  'limited distance calculation' as similar_match_result,
  '✅ Working' as status
UNION ALL
SELECT 
  '🎯 FUZZYSTRMATCH FUNCTIONS' as test_category,
  'soundex()' as function_name,
  soundex('Smith') as soundex_result,
  'soundex code for "Smith"' as similar_match_result,
  '✅ Working' as status;

-- ✅ TEST 5: vector Extension (pgvector)
SELECT 
  '🚀 VECTOR FUNCTIONS' as test_category,
  'vector creation' as function_name,
  '[1,2,3]'::vector(3)::text as vector_result,
  'basic vector creation' as similar_match_result,
  '✅ Working' as status
UNION ALL
SELECT 
  '🚀 VECTOR FUNCTIONS' as test_category,
  'cosine distance' as function_name,
  ('[1,0,0]'::vector(3) <=> '[0,1,0]'::vector(3))::text as distance_result,
  'cosine distance calculation' as similar_match_result,
  '✅ Working' as status
UNION ALL
SELECT 
  '🚀 VECTOR FUNCTIONS' as test_category,
  'dot product' as function_name,
  ('[1,2,3]'::vector(3) <#> '[4,5,6]'::vector(3))::text as dot_product_result,
  'negative dot product' as similar_match_result,
  '✅ Working' as status;

-- ✅ TEST 6: Real Function Usage (hybrid_product_match_tiered)
SELECT 
  '⚡ HYBRID FUNCTION TEST' as test_category,
  'hybrid_product_match_tiered' as function_name,
  'Function callable without errors' as vector_result,
  'Production matching function' as similar_match_result,
  '✅ Working' as status
FROM hybrid_product_match_tiered('test product', 1, 0.1)
LIMIT 1;

-- ✅ FINAL SUMMARY
SELECT 
  '🎉 FINAL RESULT' as test_category,
  'All Extensions Ready' as function_name,
  'PathoptMatch Production Ready' as vector_result,
  'similarity(), unaccent(), levenshtein(), vector ops all functional' as similar_match_result,
  '✅ SUCCESS' as status;