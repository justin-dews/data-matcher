-- Test the corrected hybrid_product_match function with no vector similarity
-- Using a realistic product query against your organization

-- First, get your organization_id
SELECT id as organization_id, name 
FROM organizations 
LIMIT 1;

-- Test the hybrid function with a common product query
SELECT 
  product_id,
  sku,
  name,
  vector_score,
  trigram_score,
  fuzzy_score,
  alias_score,
  final_score,
  match_algorithm
FROM hybrid_product_match(
  'safety glasses', -- Common industrial product
  (SELECT id FROM organizations LIMIT 1), -- Your org ID
  5, -- Limit to 5 results
  0.1 -- Low threshold to see scoring
);

-- Alternative test with bolt/screw query
SELECT 
  'BOLT TEST' as test_name,
  product_id,
  sku,
  name,
  vector_score,
  trigram_score,
  fuzzy_score,
  alias_score,
  final_score,
  match_algorithm
FROM hybrid_product_match(
  'hex bolt', 
  (SELECT id FROM organizations LIMIT 1),
  3,
  0.1
);