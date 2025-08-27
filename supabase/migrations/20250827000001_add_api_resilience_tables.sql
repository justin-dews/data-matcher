-- API Resilience Support Tables
-- 
-- This migration adds tables to support comprehensive API resilience patterns:
-- 1. Cached parsing results for PDF processing fallbacks
-- 2. Cached embeddings for OpenAI API fallbacks
-- 3. Service failure logging for monitoring
-- 4. Circuit breaker persistence

-- Table for caching PDF parsing results
CREATE TABLE IF NOT EXISTS cached_parsing_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID,
    original_filename TEXT NOT NULL,
    parsed_content JSONB NOT NULL,
    line_items_count INTEGER DEFAULT 0,
    parsing_method TEXT DEFAULT 'llamaparse',
    file_hash TEXT, -- For deduplication
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    
    -- Indexes for performance
    INDEX idx_cached_parsing_filename (original_filename),
    INDEX idx_cached_parsing_hash (file_hash),
    INDEX idx_cached_parsing_expires (expires_at)
);

-- Table for caching OpenAI embeddings
CREATE TABLE IF NOT EXISTS cached_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    text_content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI ada-002 embedding dimension
    text_hash TEXT GENERATED ALWAYS AS (md5(text_content)) STORED,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    model TEXT DEFAULT 'text-embedding-ada-002',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    
    -- Unique constraint on text hash to prevent duplicates
    UNIQUE(text_hash),
    
    -- Indexes for performance
    INDEX idx_cached_embeddings_hash (text_hash),
    INDEX idx_cached_embeddings_product (product_id),
    INDEX idx_cached_embeddings_expires (expires_at)
);

-- Table for logging service failures
CREATE TABLE IF NOT EXISTS service_failures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    error_type TEXT,
    error_message TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes for monitoring and analytics
    INDEX idx_service_failures_service (service_name, occurred_at),
    INDEX idx_service_failures_operation (operation, occurred_at),
    INDEX idx_service_failures_occurred (occurred_at)
);

-- Table for circuit breaker persistence
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name TEXT UNIQUE NOT NULL,
    state TEXT NOT NULL DEFAULT 'CLOSED', -- CLOSED, OPEN, HALF_OPEN
    failure_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    next_attempt_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CHECK (state IN ('CLOSED', 'OPEN', 'HALF_OPEN'))
);

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache_entries()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Clean up expired parsing results
    DELETE FROM cached_parsing_results
    WHERE expires_at < NOW();
    
    -- Clean up expired embeddings
    DELETE FROM cached_embeddings
    WHERE expires_at < NOW();
    
    -- Clean up old service failures (keep last 30 days)
    DELETE FROM service_failures
    WHERE occurred_at < NOW() - INTERVAL '30 days';
    
    RAISE NOTICE 'Cleaned up expired cache entries';
END;
$$;

-- Function to get cached parsing result by similarity
CREATE OR REPLACE FUNCTION find_similar_cached_parsing_result(
    filename TEXT,
    similarity_threshold REAL DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    original_filename TEXT,
    parsed_content JSONB,
    line_items_count INTEGER,
    parsing_method TEXT,
    similarity_score REAL,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cpr.id,
        cpr.document_id,
        cpr.original_filename,
        cpr.parsed_content,
        cpr.line_items_count,
        cpr.parsing_method,
        similarity(cpr.original_filename, filename) as similarity_score,
        cpr.created_at
    FROM cached_parsing_results cpr
    WHERE similarity(cpr.original_filename, filename) > similarity_threshold
      AND cpr.expires_at > NOW()
    ORDER BY similarity_score DESC, cpr.created_at DESC
    LIMIT 5;
END;
$$;

-- Function to get cached embeddings with fallback
CREATE OR REPLACE FUNCTION get_cached_embeddings_batch(
    text_contents TEXT[]
)
RETURNS TABLE (
    text_content TEXT,
    embedding vector(1536),
    model TEXT,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.text_content,
        ce.embedding,
        ce.model,
        ce.created_at
    FROM cached_embeddings ce
    WHERE ce.text_content = ANY(text_contents)
      AND ce.expires_at > NOW()
    ORDER BY ce.created_at DESC;
END;
$$;

-- Function to update circuit breaker state
CREATE OR REPLACE FUNCTION update_circuit_breaker_state(
    p_service_name TEXT,
    p_state TEXT,
    p_failure_count INTEGER DEFAULT NULL,
    p_success_count INTEGER DEFAULT NULL,
    p_next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO circuit_breaker_state (
        service_name,
        state,
        failure_count,
        success_count,
        last_failure_at,
        next_attempt_at,
        updated_at
    )
    VALUES (
        p_service_name,
        p_state,
        COALESCE(p_failure_count, 0),
        COALESCE(p_success_count, 0),
        CASE WHEN p_state = 'OPEN' THEN NOW() ELSE NULL END,
        p_next_attempt_at,
        NOW()
    )
    ON CONFLICT (service_name) 
    DO UPDATE SET
        state = EXCLUDED.state,
        failure_count = COALESCE(EXCLUDED.failure_count, circuit_breaker_state.failure_count),
        success_count = COALESCE(EXCLUDED.success_count, circuit_breaker_state.success_count),
        last_failure_at = EXCLUDED.last_failure_at,
        next_attempt_at = EXCLUDED.next_attempt_at,
        updated_at = NOW();
END;
$$;

-- Row Level Security policies
-- Cached parsing results are organization-scoped
ALTER TABLE cached_parsing_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access cached parsing results for their organization" 
    ON cached_parsing_results 
    FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM documents d 
            WHERE d.id = cached_parsing_results.document_id 
            AND d.organization_id = (
                SELECT organization_id FROM profiles 
                WHERE id = auth.uid()
            )
        )
    );

-- Cached embeddings are organization-scoped through product relationship
ALTER TABLE cached_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access cached embeddings for their organization" 
    ON cached_embeddings 
    FOR ALL 
    USING (
        product_id IS NULL OR EXISTS (
            SELECT 1 FROM products p 
            WHERE p.id = cached_embeddings.product_id 
            AND p.organization_id = (
                SELECT organization_id FROM profiles 
                WHERE id = auth.uid()
            )
        )
    );

-- Service failures are readable by all authenticated users for monitoring
ALTER TABLE service_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read service failures" 
    ON service_failures 
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Only service accounts can write service failures
CREATE POLICY "Service accounts can write service failures" 
    ON service_failures 
    FOR INSERT 
    WITH CHECK (true); -- This would be restricted to service role in production

-- Circuit breaker state is readable by authenticated users
ALTER TABLE circuit_breaker_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read circuit breaker state" 
    ON circuit_breaker_state 
    FOR ALL 
    TO authenticated 
    USING (true);

-- Create indexes for optimal performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cached_parsing_results_document_id 
    ON cached_parsing_results (document_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cached_parsing_results_filename_trgm 
    ON cached_parsing_results USING gin (original_filename gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cached_embeddings_text_trgm 
    ON cached_embeddings USING gin (text_content gin_trgm_ops);

-- Schedule cleanup job (this would typically be handled by a cron extension)
-- For now, we'll document that this should be run periodically
COMMENT ON FUNCTION cleanup_expired_cache_entries() IS 
'This function should be run periodically (e.g., daily) to clean up expired cache entries. 
Consider setting up a cron job or using Supabase''s pg_cron extension.';

-- Comments for documentation
COMMENT ON TABLE cached_parsing_results IS 'Stores cached PDF parsing results for fallback when LlamaParse API is unavailable';
COMMENT ON TABLE cached_embeddings IS 'Stores cached OpenAI embeddings for fallback when embedding API is unavailable';
COMMENT ON TABLE service_failures IS 'Logs service failures for monitoring and alerting';
COMMENT ON TABLE circuit_breaker_state IS 'Stores persistent circuit breaker state across application restarts';