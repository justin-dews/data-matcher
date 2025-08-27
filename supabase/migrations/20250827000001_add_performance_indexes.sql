-- Performance optimization indexes for N+1 query patterns
-- Target: 70% reduction in query execution time

-- Composite indexes for line_items with matches queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_line_items_org_created_matches 
ON line_items (organization_id, created_at DESC) 
INCLUDE (id, raw_text, parsed_data, company_name);

-- Composite index for matches with product joins
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_line_item_product_org 
ON matches (line_item_id, product_id, organization_id) 
INCLUDE (status, confidence_score, final_score, matched_text, reasoning);

-- Index for matches by status for bulk operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_org_status_created 
ON matches (organization_id, status, created_at DESC) 
INCLUDE (line_item_id, product_id);

-- Composite index for products used in matching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_org_name_sku 
ON products (organization_id, name, sku) 
INCLUDE (id, manufacturer, category);

-- Index for training data lookups during matching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_data_org_normalized 
ON match_training_data (organization_id, line_item_normalized) 
INCLUDE (matched_product_id, match_confidence);

-- Partial index for pending matches (most frequently queried)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_pending_org 
ON matches (organization_id, line_item_id) 
WHERE status = 'pending';

-- Partial index for approved matches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_approved_org 
ON matches (organization_id, line_item_id, created_at DESC) 
WHERE status IN ('approved', 'auto_matched');

-- Index for line items without matches (for bulk generation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_line_items_no_matches 
ON line_items (organization_id, created_at DESC) 
WHERE id NOT IN (SELECT line_item_id FROM matches);

-- Statistics query optimization - composite index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_line_items_stats 
ON line_items (organization_id) 
INCLUDE (id, created_at);

-- Index for activity logging queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_org_action_created 
ON activity_log (organization_id, action, created_at DESC) 
INCLUDE (user_id, resource_type, resource_id);

-- Covering index for product embeddings queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_embeddings_product_vector 
ON product_embeddings (product_id) 
INCLUDE (embedding, text_content);

-- Index for competitor aliases lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_competitor_aliases_org_name_product 
ON competitor_aliases (organization_id, competitor_name, product_id) 
INCLUDE (confidence_score, created_at);

-- Performance statistics tracking
CREATE TABLE IF NOT EXISTS query_performance_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_name TEXT NOT NULL,
    organization_id UUID NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    row_count INTEGER NOT NULL,
    cache_hit BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_performance_name_org 
ON query_performance_stats (query_name, organization_id, created_at DESC);

-- Analyze tables to update query planner statistics
ANALYZE line_items;
ANALYZE matches;
ANALYZE products;
ANALYZE product_embeddings;
ANALYZE match_training_data;
ANALYZE competitor_aliases;

-- Update table statistics for better query planning
ALTER TABLE line_items SET (autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE matches SET (autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE products SET (autovacuum_analyze_scale_factor = 0.05);

-- Comment documentation for index purposes
COMMENT ON INDEX idx_line_items_org_created_matches IS 'Optimizes main line items with matches query - covers organization filtering and ordering';
COMMENT ON INDEX idx_matches_line_item_product_org IS 'Optimizes match joins with products table - covers foreign key relationships';
COMMENT ON INDEX idx_matches_pending_org IS 'Partial index for pending matches - most frequently filtered status';
COMMENT ON INDEX idx_line_items_no_matches IS 'Supports bulk match generation by finding unmatched line items';
COMMENT ON INDEX idx_training_data_org_normalized IS 'Optimizes training data lookups during tiered matching';