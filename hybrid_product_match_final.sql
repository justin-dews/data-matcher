-- FINAL CORRECTED VERSION - All issues addressed
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
BEGIN
  -- Step 1: Input Validation & Preprocessing
  
  -- Handle null/empty inputs
  IF query_text IS NULL OR trim(query_text) = '' THEN
    RETURN; -- Empty result set
  END IF;
  
  -- Handle null organization_id
  IF organization_id IS NULL THEN
    RETURN; -- Empty result set
  END IF;

  -- Normalize query text using our function
  normalized_query := normalize_product_text(query_text);
  
  -- If normalization results in empty string, return empty
  IF normalized_query IS NULL OR trim(normalized_query) = '' THEN
    RETURN; -- Empty result set
  END IF;

  -- Set reasonable defaults and bounds
  limit_count := COALESCE(limit_count, 10);
  limit_count := GREATEST(1, LEAST(limit_count, 100)); -- Bound between 1-100
  
  threshold := COALESCE(threshold, 0.85);
  threshold := GREATEST(0.0, LEAST(threshold, 1.0)); -- Bound between 0-1

  -- Create unique temp table suffix - simplified and safe
  temp_suffix := 't' || floor(extract(epoch from clock_timestamp()))::text || floor(random() * 10000)::text;

  -- Step 2: Get trigram candidates using existing index
  EXECUTE format('DROP TABLE IF EXISTS candidates_%s', temp_suffix);
  EXECUTE format('CREATE TEMP TABLE candidates_%s AS
    SELECT DISTINCT p.id as product_id, p.sku, p.name
    FROM products p
    WHERE p.organization_id = %L
      AND similarity(normalize_product_text(p.name), %L) > 0.1
    ORDER BY similarity(normalize_product_text(p.name), %L) DESC
    LIMIT 500', temp_suffix, organization_id, normalized_query, normalized_query);

  -- Step 3: Calculate scores with proper type casting
  EXECUTE format('DROP TABLE IF EXISTS final_results_%s', temp_suffix);
  EXECUTE format('CREATE TEMP TABLE final_results_%s AS
    SELECT 
      c.product_id,
      c.sku,
      c.name,
      0.0::double precision as vector_score,
      COALESCE(similarity(normalize_product_text(c.name), %L), 0.0)::double precision as trigram_score,
      COALESCE(calculate_fuzzy_score(normalize_product_text(c.name), %L), 0.0)::double precision as fuzzy_score,
      0.0::double precision as alias_score,
      (COALESCE(similarity(normalize_product_text(c.name), %L), 0.0) * 0.6 + 
       COALESCE(calculate_fuzzy_score(normalize_product_text(c.name), %L), 0.0) * 0.4)::double precision as final_score,
      CASE 
        WHEN COALESCE(similarity(normalize_product_text(c.name), %L), 0.0) >= 
             COALESCE(calculate_fuzzy_score(normalize_product_text(c.name), %L), 0.0) 
        THEN ''trigram''
        ELSE ''fuzzy''
      END as match_algorithm
    FROM candidates_%s c', temp_suffix, normalized_query, normalized_query, normalized_query, normalized_query, normalized_query, normalized_query, temp_suffix);

  -- Step 4: Return filtered and sorted results
  RETURN QUERY EXECUTE format('
    SELECT 
      fr.product_id,
      fr.sku,
      fr.name,
      fr.vector_score,
      fr.trigram_score,
      fr.fuzzy_score,
      fr.alias_score,
      fr.final_score,
      fr.match_algorithm
    FROM final_results_%s fr
    WHERE fr.final_score >= %L
    ORDER BY fr.final_score DESC, fr.trigram_score DESC
    LIMIT %L', temp_suffix, threshold, limit_count);

  -- Step 5: Cleanup temporary tables
  EXECUTE format('DROP TABLE IF EXISTS candidates_%s', temp_suffix);
  EXECUTE format('DROP TABLE IF EXISTS final_results_%s', temp_suffix);

EXCEPTION
  -- Error handling: cleanup and re-raise
  WHEN OTHERS THEN
    BEGIN
      EXECUTE format('DROP TABLE IF EXISTS candidates_%s', temp_suffix);
      EXECUTE format('DROP TABLE IF EXISTS final_results_%s', temp_suffix);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignore cleanup errors
    END;
    RAISE;
END;
$$;