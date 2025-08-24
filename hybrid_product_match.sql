-- Main hybrid product matching function combining all algorithms
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

  -- Step 2: Candidate Filtering (Performance Optimization)
  
  -- 2a. Get trigram candidates using existing index
  DROP TABLE IF EXISTS trigram_candidates;
  CREATE TEMP TABLE trigram_candidates AS
  SELECT DISTINCT 
    p.id as product_id, 
    p.sku, 
    p.name,
    similarity(normalize_product_text(p.name), normalized_query) as trgm_sim
  FROM products p
  WHERE p.organization_id = $2
    AND similarity(normalize_product_text(p.name), normalized_query) > 0.1
  ORDER BY trgm_sim DESC
  LIMIT 500;

  -- 2b. Get vector candidates using existing index (if embeddings exist)
  DROP TABLE IF EXISTS vector_candidates;
  CREATE TEMP TABLE vector_candidates AS
  SELECT DISTINCT 
    p.id as product_id, 
    p.sku, 
    p.name,
    1 - (pe.embedding <=> (
      SELECT pe2.embedding FROM product_embeddings pe2 
      JOIN products p2 ON pe2.product_id = p2.id
      WHERE p2.organization_id = $2 
        AND normalize_product_text(p2.name) = normalized_query 
      LIMIT 1
    )) as vec_sim
  FROM products p
  JOIN product_embeddings pe ON pe.product_id = p.id
  WHERE p.organization_id = $2
    AND pe.embedding IS NOT NULL
  ORDER BY vec_sim DESC
  LIMIT 100;

  -- 2c. Merge candidate sets
  DROP TABLE IF EXISTS all_candidates;
  CREATE TEMP TABLE all_candidates AS
  SELECT tc.product_id, tc.sku, tc.name FROM trigram_candidates tc
  UNION
  SELECT vc.product_id, vc.sku, vc.name FROM vector_candidates vc;

  -- Step 3: Multi-Algorithm Scoring
  
  -- 3a. Calculate individual scores for each candidate
  DROP TABLE IF EXISTS scored_candidates;
  CREATE TEMP TABLE scored_candidates AS
  SELECT 
    ac.product_id,
    ac.sku,
    ac.name,
    
    -- Vector similarity score (0-1)
    COALESCE(
      (SELECT 1 - (pe.embedding <=> (
         SELECT pe2.embedding FROM product_embeddings pe2 
         JOIN products p2 ON pe2.product_id = p2.id
         WHERE p2.organization_id = $2 
           AND normalize_product_text(p2.name) = normalized_query 
         LIMIT 1
       ))
       FROM product_embeddings pe 
       WHERE pe.product_id = ac.product_id), 
      0.0
    ) as vector_score,
    
    -- Trigram similarity score (0-1)
    COALESCE(
      similarity(normalize_product_text(ac.name), normalized_query), 
      0.0
    ) as trigram_score,
    
    -- Fuzzy similarity score (0-1) - our function
    COALESCE(
      calculate_fuzzy_score(normalize_product_text(ac.name), normalized_query),
      0.0
    ) as fuzzy_score,
    
    -- Alias boost score (0-1) - our function
    COALESCE(
      get_alias_boost(query_text, ac.product_id, $2),
      0.0
    ) as alias_score

  FROM all_candidates ac;

  -- 3b. Calculate final combined score
  DROP TABLE IF EXISTS final_scores;
  CREATE TEMP TABLE final_scores AS
  SELECT *,
    -- Weighted combination: Vector 40%, Trigram 30%, Fuzzy 20%, Alias 10%
    (vector_score * 0.4) + (trigram_score * 0.3) + 
    (fuzzy_score * 0.2) + (alias_score * 0.1) as final_score,
    
    -- Determine primary matching algorithm
    CASE 
      WHEN vector_score = GREATEST(vector_score, trigram_score, fuzzy_score, alias_score) 
        THEN 'vector'
      WHEN trigram_score = GREATEST(vector_score, trigram_score, fuzzy_score, alias_score) 
        THEN 'trigram'  
      WHEN fuzzy_score = GREATEST(vector_score, trigram_score, fuzzy_score, alias_score) 
        THEN 'fuzzy'
      WHEN alias_score = GREATEST(vector_score, trigram_score, fuzzy_score, alias_score)
        THEN 'alias'
      ELSE 'hybrid'
    END as match_algorithm

  FROM scored_candidates;

  -- Step 4: Return filtered and sorted results
  RETURN QUERY
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
  FROM final_scores fs
  WHERE fs.final_score >= threshold
  ORDER BY fs.final_score DESC, fs.vector_score DESC
  LIMIT limit_count;

  -- Step 5: Cleanup temporary tables
  DROP TABLE IF EXISTS trigram_candidates;
  DROP TABLE IF EXISTS vector_candidates; 
  DROP TABLE IF EXISTS all_candidates;
  DROP TABLE IF EXISTS scored_candidates;
  DROP TABLE IF EXISTS final_scores;

EXCEPTION
  -- Error handling: cleanup and re-raise
  WHEN OTHERS THEN
    DROP TABLE IF EXISTS trigram_candidates;
    DROP TABLE IF EXISTS vector_candidates; 
    DROP TABLE IF EXISTS all_candidates;
    DROP TABLE IF EXISTS scored_candidates;
    DROP TABLE IF EXISTS final_scores;
    RAISE;
END;
$$;