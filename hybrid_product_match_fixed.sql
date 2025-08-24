-- Main hybrid product matching function combining all algorithms - FIXED VERSION
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

  -- Create unique temp table suffix to avoid conflicts (use only alphanumeric)
  temp_suffix := 't' || replace(extract(epoch from clock_timestamp())::text, '.', '') || '_' || replace(random()::text, '.', '0');

  -- Step 2: Candidate Filtering (Performance Optimization)
  
  -- 2a. Get trigram candidates using existing index
  EXECUTE format('DROP TABLE IF EXISTS trigram_candidates_%s', temp_suffix);
  EXECUTE format('CREATE TEMP TABLE trigram_candidates_%s AS
    SELECT DISTINCT 
      p.id as product_id, 
      p.sku, 
      p.name,
      similarity(normalize_product_text(p.name), %L) as trgm_sim
    FROM products p
    WHERE p.organization_id = %L
      AND similarity(normalize_product_text(p.name), %L) > 0.1
    ORDER BY trgm_sim DESC
    LIMIT 500', temp_suffix, normalized_query, organization_id, normalized_query);

  -- 2b. Skip vector candidates for now (no embedding generation available)
  -- Create empty vector candidates table for compatibility
  EXECUTE format('DROP TABLE IF EXISTS vector_candidates_%s', temp_suffix);  
  EXECUTE format('CREATE TEMP TABLE vector_candidates_%s (
    product_id UUID, sku TEXT, name TEXT, vec_sim FLOAT
  )', temp_suffix);

  -- 2c. Merge candidate sets (currently just trigram candidates)
  EXECUTE format('DROP TABLE IF EXISTS all_candidates_%s', temp_suffix);
  EXECUTE format('CREATE TEMP TABLE all_candidates_%s AS
    SELECT product_id, sku, name FROM trigram_candidates_%s', temp_suffix, temp_suffix);

  -- Step 3: Multi-Algorithm Scoring
  
  -- 3a. Calculate individual scores for each candidate
  EXECUTE format('DROP TABLE IF EXISTS scored_candidates_%s', temp_suffix);
  EXECUTE format('CREATE TEMP TABLE scored_candidates_%s AS
    SELECT 
      ac.product_id,
      ac.sku,
      ac.name,
      0.0 as vector_score,
      COALESCE(similarity(normalize_product_text(ac.name), %L), 0.0) as trigram_score,
      COALESCE(calculate_fuzzy_score(normalize_product_text(ac.name), %L), 0.0) as fuzzy_score,
      0.0 as alias_score
    FROM all_candidates_%s ac', temp_suffix, normalized_query, normalized_query, temp_suffix);

  -- 3b. Calculate final combined score (adjusted weights since vector/alias are 0)
  EXECUTE format('DROP TABLE IF EXISTS final_scores_%s', temp_suffix);
  EXECUTE format('CREATE TEMP TABLE final_scores_%s AS
    SELECT *,
      (trigram_score * 0.6) + (fuzzy_score * 0.4) as final_score,
      CASE 
        WHEN trigram_score >= fuzzy_score THEN ''trigram''
        ELSE ''fuzzy''
      END as match_algorithm
    FROM scored_candidates_%s', temp_suffix, temp_suffix);

  -- Step 4: Return filtered and sorted results
  RETURN QUERY EXECUTE format('
    SELECT 
      fs.product_id,
      fs.sku,
      fs.name,
      fs.vector_score,
      fs.trigram_score,
      fs.fuzzy_score,
      fs.alias_score,
      fs.final_score,
      fs.match_algorithm
    FROM final_scores_%s fs
    WHERE fs.final_score >= %L
    ORDER BY fs.final_score DESC, fs.trigram_score DESC
    LIMIT %L', temp_suffix, threshold, limit_count);

  -- Step 5: Cleanup temporary tables
  EXECUTE format('DROP TABLE IF EXISTS trigram_candidates_%s', temp_suffix);
  EXECUTE format('DROP TABLE IF EXISTS vector_candidates_%s', temp_suffix);
  EXECUTE format('DROP TABLE IF EXISTS all_candidates_%s', temp_suffix);
  EXECUTE format('DROP TABLE IF EXISTS scored_candidates_%s', temp_suffix);
  EXECUTE format('DROP TABLE IF EXISTS final_scores_%s', temp_suffix);

EXCEPTION
  -- Error handling: cleanup and re-raise
  WHEN OTHERS THEN
    BEGIN
      EXECUTE format('DROP TABLE IF EXISTS trigram_candidates_%s', temp_suffix);
      EXECUTE format('DROP TABLE IF EXISTS vector_candidates_%s', temp_suffix);
      EXECUTE format('DROP TABLE IF EXISTS all_candidates_%s', temp_suffix);
      EXECUTE format('DROP TABLE IF EXISTS scored_candidates_%s', temp_suffix);
      EXECUTE format('DROP TABLE IF EXISTS final_scores_%s', temp_suffix);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignore cleanup errors
    END;
    RAISE;
END;
$$;