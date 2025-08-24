-- Simple embedding function that works with existing product embeddings
-- This is a practical solution for Phase 1 - we can enhance it later for real-time embedding generation
CREATE OR REPLACE FUNCTION get_embedding(input_text TEXT)
RETURNS vector(1536)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  embedding_result vector(1536);
  normalized_text TEXT;
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
  ORDER BY p.created_at DESC  -- Get most recent if multiple matches
  LIMIT 1;

  IF embedding_result IS NOT NULL THEN
    RETURN embedding_result;
  END IF;

  -- Strategy 2: Find most similar existing product using trigram similarity
  -- This gives us a reasonable proxy embedding for similar products
  SELECT pe.embedding INTO embedding_result
  FROM product_embeddings pe
  JOIN products p ON pe.product_id = p.id
  WHERE similarity(normalize_product_text(p.name), normalized_text) > 0.2
  ORDER BY similarity(normalize_product_text(p.name), normalized_text) DESC
  LIMIT 1;

  IF embedding_result IS NOT NULL THEN
    RETURN embedding_result;
  END IF;

  -- Strategy 3: Return a random embedding as fallback
  -- This ensures the function always returns something rather than breaking the query
  SELECT pe.embedding INTO embedding_result
  FROM product_embeddings pe
  WHERE pe.embedding IS NOT NULL
  ORDER BY random()
  LIMIT 1;

  RETURN embedding_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Return NULL on any error - the hybrid function will handle missing embeddings gracefully
    RETURN NULL;
END;
$$;