-- Cleanup: Remove unused embedding functions after disabling vector similarity
-- These functions are no longer needed since we've set vector weight to 0%

-- Remove embedding functions that were created during testing/experimentation
DROP FUNCTION IF EXISTS get_embedding(TEXT, UUID);
DROP FUNCTION IF EXISTS get_embedding_simple(TEXT, UUID);
DROP FUNCTION IF EXISTS get_embedding_cached(TEXT, UUID);
DROP FUNCTION IF EXISTS get_embedding_category_based(TEXT, UUID);

-- Remove helper function for category-based embeddings
DROP FUNCTION IF EXISTS get_product_category(TEXT);

-- Note: We're keeping the existing product_embeddings table and data
-- in case vector similarity is re-enabled in the future
-- The embeddings don't consume significant storage and may be useful for other features

-- Verify cleanup - these should return no results after running cleanup
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name LIKE '%embedding%' AND routine_schema = 'public';