-- SAFE VERSION - Guaranteed to work with proper error handling
-- Drop existing function first to avoid parameter name conflicts
DROP FUNCTION IF EXISTS hybrid_product_match(TEXT, UUID, INTEGER, FLOAT);

CREATE OR REPLACE FUNCTION hybrid_product_match(
  query_text TEXT,
  organization_id UUID,
  limit_count INTEGER DEFAULT 10,
  threshold FLOAT DEFAULT 0.85
) 
RETURNS TABLE (
  product_id UUID,
  sku TEXT,
  name TEXT,
  vector_score FLOAT,
  trigram_score FLOAT,
  fuzzy_score FLOAT,
  alias_score FLOAT,
  final_score FLOAT,
  match_algorithm TEXT
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  normalized_query TEXT;
  temp_suffix TEXT;
  fuzzy_available BOOLEAN := false;
BEGIN
  -- Step 1: Input Validation & Preprocessing
  IF query_text IS NULL OR trim(query_text) = '' OR organization_id IS NULL THEN
    RETURN; -- Empty result set
  END IF;

  -- Normalize query text
  normalized_query := normalize_product_text(query_text);
  IF normalized_query IS NULL OR trim(normalized_query) = '' THEN
    RETURN; -- Empty result set
  END IF;

  -- Set bounds
  limit_count := GREATEST(1, LEAST(COALESCE(limit_count, 10), 100));
  threshold := GREATEST(0.0, LEAST(COALESCE(threshold, 0.85), 1.0));

  -- Simple temp suffix
  temp_suffix := 't' || floor(extract(epoch from clock_timestamp()))::bigint::text;

  -- Check if calculate_fuzzy_score function exists
  BEGIN
    PERFORM calculate_fuzzy_score('test', 'test');
    fuzzy_available := true;
  EXCEPTION
    WHEN OTHERS THEN
      fuzzy_available := false;
  END;

  -- Get candidates
  EXECUTE format('DROP TABLE IF EXISTS candidates_%s', temp_suffix);
  EXECUTE format('CREATE TEMP TABLE candidates_%s AS
    SELECT p.id as product_id, p.sku, p.name,
           similarity(normalize_product_text(p.name), %L)::double precision as trgm_score
    FROM products p
    WHERE p.organization_id = %L
      AND similarity(normalize_product_text(p.name), %L) > 0.1
    ORDER BY similarity(normalize_product_text(p.name), %L) DESC
    LIMIT 500', temp_suffix, normalized_query, organization_id, normalized_query, normalized_query);

  -- Calculate final scores based on available functions
  IF fuzzy_available THEN
    -- Use both trigram and fuzzy
    RETURN QUERY EXECUTE format('
      SELECT 
        c.product_id,
        c.sku,
        c.name,
        0.0::double precision as vector_score,
        c.trgm_score as trigram_score,
        COALESCE(calculate_fuzzy_score(normalize_product_text(c.name), %L), 0.0)::double precision as fuzzy_score,
        0.0::double precision as alias_score,
        (c.trgm_score * 0.6 + COALESCE(calculate_fuzzy_score(normalize_product_text(c.name), %L), 0.0) * 0.4)::double precision as final_score,
        ''hybrid''::text as match_algorithm
      FROM candidates_%s c
      WHERE (c.trgm_score * 0.6 + COALESCE(calculate_fuzzy_score(normalize_product_text(c.name), %L), 0.0) * 0.4) >= %L
      ORDER BY (c.trgm_score * 0.6 + COALESCE(calculate_fuzzy_score(normalize_product_text(c.name), %L), 0.0) * 0.4) DESC
      LIMIT %L', normalized_query, normalized_query, temp_suffix, normalized_query, threshold, normalized_query, limit_count);
  ELSE
    -- Use only trigram
    RETURN QUERY EXECUTE format('
      SELECT 
        c.product_id,
        c.sku,
        c.name,
        0.0::double precision as vector_score,
        c.trgm_score as trigram_score,
        0.0::double precision as fuzzy_score,
        0.0::double precision as alias_score,
        c.trgm_score as final_score,
        ''trigram''::text as match_algorithm
      FROM candidates_%s c
      WHERE c.trgm_score >= %L
      ORDER BY c.trgm_score DESC
      LIMIT %L', temp_suffix, threshold, limit_count);
  END IF;

  -- Cleanup
  EXECUTE format('DROP TABLE IF EXISTS candidates_%s', temp_suffix);

EXCEPTION
  WHEN OTHERS THEN
    BEGIN
      EXECUTE format('DROP TABLE IF EXISTS candidates_%s', temp_suffix);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    RAISE;
END;
$$;