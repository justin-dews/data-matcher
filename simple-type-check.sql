-- Simple direct type check for key columns
-- This should show us the exact types we're dealing with

-- Direct column type query
SELECT 
    'products.id' as column_reference,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'products' 
    AND column_name = 'id'

UNION ALL

SELECT 
    'match_training_data.matched_product_id' as column_reference,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'match_training_data' 
    AND column_name = 'matched_product_id'

UNION ALL

SELECT 
    'competitor_aliases.product_id' as column_reference,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'competitor_aliases' 
    AND column_name = 'product_id'

ORDER BY column_reference;