-- Test the RLS-compatible hybrid_product_match function
-- This will help us understand why it's returning 0 matches

-- 1. Check if we can see products with RLS (should work since we're authenticated as service role)
SELECT 'Products visible in database:' as test;
SELECT COUNT(*) as product_count, 
       string_agg(DISTINCT LEFT(name, 30), ', ') as sample_names
FROM products 
LIMIT 5;

-- 2. Test the normalize_product_text function if it exists
SELECT 'Testing normalize_product_text function:' as test;
SELECT 
    'PLUG, HEX HD, BRASS PIPE, 3/8" NPT' as original,
    normalize_product_text('PLUG, HEX HD, BRASS PIPE, 3/8" NPT') as normalized;

-- 3. Test similarity function directly
SELECT 'Testing similarity function:' as test;
SELECT 
    similarity('PLUG HEX BRASS PIPE', name) as sim_score,
    name,
    sku
FROM products 
WHERE similarity('PLUG HEX BRASS PIPE', name) > 0.1
ORDER BY sim_score DESC
LIMIT 5;

-- 4. Test the hybrid function directly with a simple query
SELECT 'Testing hybrid_product_match function:' as test;
SELECT * FROM hybrid_product_match('PLUG BRASS', 5, 0.1);