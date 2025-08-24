-- Practical embedding function that looks up existing embeddings or returns average
CREATE OR REPLACE FUNCTION get_embedding(input_text TEXT, org_id UUID DEFAULT NULL)
RETURNS vector(1536)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  embedding_result vector(1536);
  normalized_text TEXT;
  match_count INTEGER := 0;
BEGIN
  -- Handle null/empty input
  IF input_text IS NULL OR trim(input_text) = '' THEN
    RETURN NULL;
  END IF;

  -- Normalize the input text for consistent matching
  normalized_text := normalize_product_text(input_text);
  
  IF normalized_text IS NULL OR trim(normalized_text) = '' THEN
    RETURN NULL;
  END IF;

  -- Strategy 1: Look for exact normalized text match in existing embeddings
  SELECT pe.embedding INTO embedding_result
  FROM product_embeddings pe
  JOIN products p ON pe.product_id = p.id
  WHERE normalize_product_text(p.name) = normalized_text
    AND (org_id IS NULL OR p.organization_id = org_id)
  LIMIT 1;

  IF embedding_result IS NOT NULL THEN
    RETURN embedding_result;
  END IF;

  -- Strategy 2: Find most similar existing product using trigram similarity
  SELECT pe.embedding INTO embedding_result
  FROM product_embeddings pe
  JOIN products p ON pe.product_id = p.id
  WHERE similarity(normalize_product_text(p.name), normalized_text) > 0.3
    AND (org_id IS NULL OR p.organization_id = org_id)
  ORDER BY similarity(normalize_product_text(p.name), normalized_text) DESC
  LIMIT 1;

  IF embedding_result IS NOT NULL THEN
    RETURN embedding_result;
  END IF;

  -- Strategy 3: If no good match, return average embedding from same organization
  IF org_id IS NOT NULL THEN
    SELECT 
      (
        SELECT string_agg(
          (embedding_values.val)::text, ','
        )::vector(1536)
        FROM (
          SELECT 
            AVG((embedding_elements.element_value)::float) as val
          FROM (
            SELECT 
              unnest(string_to_array(substring(pe.embedding::text, 2, length(pe.embedding::text)-2), ',')::float[]) as element_value,
              generate_subscripts(string_to_array(substring(pe.embedding::text, 2, length(pe.embedding::text)-2), ','), 1) as element_index
            FROM product_embeddings pe
            JOIN products p ON pe.product_id = p.id
            WHERE p.organization_id = org_id
              AND pe.embedding IS NOT NULL
            LIMIT 10  -- Use sample to avoid performance issues
          ) embedding_elements
          GROUP BY embedding_elements.element_index
          ORDER BY embedding_elements.element_index
        ) embedding_values
      ) INTO embedding_result;

    IF embedding_result IS NOT NULL THEN
      RETURN embedding_result;
    END IF;
  END IF;

  -- Strategy 4: If all else fails, return NULL (hybrid function will handle this)
  RETURN NULL;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error for debugging but don't fail the entire query
    RAISE WARNING 'get_embedding failed for text "%": %', 
      substring(input_text, 1, 50), 
      SQLERRM;
    
    RETURN NULL;
END;
$$;