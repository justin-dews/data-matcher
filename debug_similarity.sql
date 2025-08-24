-- Step 3: Test similarity function with real product data
SELECT 
    name,
    sku,
    similarity(normalize_product_text(name), normalize_product_text('PLUG BRASS')) as sim_score
FROM products 
ORDER BY sim_score DESC
LIMIT 5;