-- OPTION A IMPLEMENTATION - Disable Vector Similarity, Focus on Working Algorithms
-- Reweighted: Trigram 50%, Fuzzy 30%, Alias 20%
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

  -- Create unique temp table suffix
  temp_suffix := 't' || floor(extract(epoch from clock_timestamp()))::bigint::text;

  -- Step 2: Simplified Candidate Filtering (Trigram Only)
  -- Focus on the working algorithm for candidate selection
  
  EXECUTE format('DROP TABLE IF EXISTS candidates_%s', temp_suffix);
  EXECUTE format('CREATE TEMP TABLE candidates_%s AS
    SELECT DISTINCT p.id as product_id, p.sku, p.name,
           similarity(normalize_product_text(p.name), %L) as trgm_sim
    FROM products p
    WHERE p.organization_id = %L
      AND similarity(normalize_product_text(p.name), %L) > 0.1
    ORDER BY trgm_sim DESC
    LIMIT 500', temp_suffix, normalized_query, organization_id, normalized_query);

  -- Step 3: Multi-Algorithm Scoring (Excluding Vector)
  
  EXECUTE format('DROP TABLE IF EXISTS final_results_%s', temp_suffix);
  EXECUTE format('CREATE TEMP TABLE final_results_%s AS
    SELECT 
      c.product_id,
      c.sku,
      c.name,
      
      -- Vector similarity: DISABLED (set to 0.0)
      0.0::double precision as vector_score,
      
      -- Trigram similarity score (0-1) - REWEIGHTED to 50%%
      COALESCE(
        similarity(normalize_product_text(c.name), %L)::double precision, 
        0.0::double precision
      ) as trigram_score,
      
      -- Fuzzy similarity score (0-1) - REWEIGHTED to 30%%  
      COALESCE(
        calculate_fuzzy_score(normalize_product_text(c.name), %L)::double precision,
        0.0::double precision
      ) as fuzzy_score,
      
      -- Alias boost score (0-1) - REWEIGHTED to 20%%
      COALESCE(
        get_alias_boost(%L, c.product_id, %L)::double precision,
        0.0::double precision
      ) as alias_score,
      
      -- REWEIGHTED FORMULA: Trigram 50%%, Fuzzy 30%%, Alias 20%%, Vector 0%%
      (
        (COALESCE(similarity(normalize_product_text(c.name), %L)::double precision, 0.0) * 0.5) + 
        (COALESCE(calculate_fuzzy_score(normalize_product_text(c.name), %L)::double precision, 0.0) * 0.3) + 
        (COALESCE(get_alias_boost(%L, c.product_id, %L)::double precision, 0.0) * 0.2)
      ) as final_score,
      
      -- Determine primary matching algorithm (excluding vector)
      CASE 
        WHEN COALESCE(similarity(normalize_product_text(c.name), %L)::double precision, 0.0) = 
             GREATEST(
               COALESCE(similarity(normalize_product_text(c.name), %L)::double precision, 0.0), 
               COALESCE(calculate_fuzzy_score(normalize_product_text(c.name), %L)::double precision, 0.0), 
               COALESCE(get_alias_boost(%L, c.product_id, %L)::double precision, 0.0)
             )
          THEN ''trigram''  
        WHEN COALESCE(calculate_fuzzy_score(normalize_product_text(c.name), %L)::double precision, 0.0) = 
             GREATEST(
               COALESCE(similarity(normalize_product_text(c.name), %L)::double precision, 0.0), 
               COALESCE(calculate_fuzzy_score(normalize_product_text(c.name), %L)::double precision, 0.0), 
               COALESCE(get_alias_boost(%L, c.product_id, %L)::double precision, 0.0)
             )
          THEN ''fuzzy''
        WHEN COALESCE(get_alias_boost(%L, c.product_id, %L)::double precision, 0.0) = 
             GREATEST(
               COALESCE(similarity(normalize_product_text(c.name), %L)::double precision, 0.0), 
               COALESCE(calculate_fuzzy_score(normalize_product_text(c.name), %L)::double precision, 0.0), 
               COALESCE(get_alias_boost(%L, c.product_id, %L)::double precision, 0.0)
             )
          THEN ''alias''
        ELSE ''hybrid''
      END as match_algorithm

    FROM candidates_%s c', 
    temp_suffix, 
    normalized_query, normalized_query, query_text, organization_id, 
    normalized_query, normalized_query, query_text, organization_id,
    normalized_query, normalized_query, normalized_query, query_text, organization_id,
    normalized_query, normalized_query, normalized_query, query_text, organization_id,
    query_text, organization_id, normalized_query, normalized_query, query_text, organization_id,
    temp_suffix);

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
    ORDER BY fr.final_score DESC, fr.trigram_score DESC, fr.fuzzy_score DESC
    LIMIT %L', temp_suffix, threshold, limit_count);

  -- Step 5: Cleanup
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