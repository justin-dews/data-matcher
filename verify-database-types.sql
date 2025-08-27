-- Verify Actual Database Schema Types
-- This will show us the real PostgreSQL types vs TypeScript interface assumptions

-- Check column types for all key relationship fields
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.udt_name,
    CASE 
        WHEN c.data_type = 'uuid' THEN 'UUID'
        WHEN c.data_type = 'text' THEN 'TEXT' 
        WHEN c.data_type = 'character varying' THEN 'VARCHAR'
        ELSE c.data_type
    END as simplified_type
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
    AND t.table_name IN ('products', 'match_training_data', 'competitor_aliases')
    AND c.column_name IN ('id', 'product_id', 'matched_product_id')
ORDER BY t.table_name, c.column_name;

-- Verify foreign key relationships and their types
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    c1.data_type as local_type,
    c2.data_type as foreign_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.columns c1 
    ON c1.table_name = tc.table_name 
    AND c1.column_name = kcu.column_name
    AND c1.table_schema = tc.table_schema
JOIN information_schema.columns c2 
    ON c2.table_name = ccu.table_name 
    AND c2.column_name = ccu.column_name
    AND c2.table_schema = ccu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name IN ('match_training_data', 'competitor_aliases')
ORDER BY tc.table_name;

-- Test the actual comparisons we need for JOINs
SELECT 'Type compatibility test results:' as test_section;

-- Test 1: products.id compared to match_training_data.matched_product_id
DO $$
DECLARE
    products_id_type TEXT;
    training_matched_id_type TEXT;
BEGIN
    SELECT data_type INTO products_id_type
    FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'id';
    
    SELECT data_type INTO training_matched_id_type
    FROM information_schema.columns 
    WHERE table_name = 'match_training_data' AND column_name = 'matched_product_id';
    
    RAISE NOTICE 'products.id type: %, match_training_data.matched_product_id type: %', 
        products_id_type, training_matched_id_type;
    
    IF products_id_type = training_matched_id_type THEN
        RAISE NOTICE 'JOIN should work: products.id = match_training_data.matched_product_id (no casting)';
    ELSE
        RAISE NOTICE 'JOIN needs casting: types do not match';
    END IF;
END
$$;

-- Test 2: products.id compared to competitor_aliases.product_id  
DO $$
DECLARE
    products_id_type TEXT;
    aliases_product_id_type TEXT;
BEGIN
    SELECT data_type INTO products_id_type
    FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'id';
    
    SELECT data_type INTO aliases_product_id_type
    FROM information_schema.columns 
    WHERE table_name = 'competitor_aliases' AND column_name = 'product_id';
    
    RAISE NOTICE 'products.id type: %, competitor_aliases.product_id type: %', 
        products_id_type, aliases_product_id_type;
    
    IF products_id_type = aliases_product_id_type THEN
        RAISE NOTICE 'JOIN should work: products.id = competitor_aliases.product_id (no casting)';
    ELSE
        RAISE NOTICE 'JOIN needs casting between % and %', products_id_type, aliases_product_id_type;
    END IF;
END
$$;

SELECT 'Database type verification complete' as status;