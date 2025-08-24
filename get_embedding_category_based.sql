-- Category-based embedding function for realistic vector similarity scores
-- Uses organization average embeddings by product category for meaningful baselines

-- First, create category detection function
CREATE OR REPLACE FUNCTION get_product_category(product_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Normalize input
  product_name := LOWER(trim(product_name));
  
  -- Fasteners category
  IF product_name LIKE '%bolt%' OR 
     product_name LIKE '%screw%' OR 
     product_name LIKE '%nut%' OR
     product_name LIKE '%washer%' OR
     product_name LIKE '%fastener%' THEN
    RETURN 'fasteners';
  END IF;
  
  -- Safety equipment category  
  IF product_name LIKE '%safety%' OR 
     product_name LIKE '%glasses%' OR
     product_name LIKE '%goggles%' OR
     product_name LIKE '%glove%' OR
     product_name LIKE '%helmet%' OR
     product_name LIKE '%vest%' THEN
    RETURN 'safety';
  END IF;
  
  -- Tools category
  IF product_name LIKE '%drill%' OR
     product_name LIKE '%wrench%' OR
     product_name LIKE '%hammer%' OR
     product_name LIKE '%tool%' THEN
    RETURN 'tools';
  END IF;
  
  -- Electrical category
  IF product_name LIKE '%wire%' OR
     product_name LIKE '%cable%' OR
     product_name LIKE '%electrical%' OR
     product_name LIKE '%connector%' THEN
    RETURN 'electrical';
  END IF;
  
  -- Default category
  RETURN 'general';
END;
$$;

-- Create improved embedding function using category averages
CREATE OR REPLACE FUNCTION get_embedding(input_text TEXT)
RETURNS vector(1536)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  query_category TEXT;
  category_centroid vector(1536);
  general_centroid vector(1536);
  embedding_count INTEGER;
BEGIN
  -- Handle null/empty input
  IF input_text IS NULL OR trim(input_text) = '' THEN
    RETURN NULL;
  END IF;

  -- Determine query category
  query_category := get_product_category(input_text);
  
  -- Strategy 1: Get category centroid (average of all products in this category)
  SELECT 
    AVG(pe.embedding),
    COUNT(*)
  INTO category_centroid, embedding_count
  FROM product_embeddings pe
  JOIN products p ON pe.product_id = p.id
  WHERE get_product_category(p.name) = query_category
    AND pe.embedding IS NOT NULL;

  -- If we found embeddings for this category and have reasonable sample size
  IF category_centroid IS NOT NULL AND embedding_count >= 3 THEN
    RETURN category_centroid;
  END IF;
  
  -- Strategy 2: Get general centroid (average of all embeddings)
  SELECT AVG(pe.embedding) INTO general_centroid
  FROM product_embeddings pe
  WHERE pe.embedding IS NOT NULL;
  
  IF general_centroid IS NOT NULL THEN
    RETURN general_centroid;
  END IF;
  
  -- Strategy 3: Return a random embedding as last resort
  SELECT pe.embedding INTO general_centroid
  FROM product_embeddings pe
  WHERE pe.embedding IS NOT NULL
  ORDER BY random()
  LIMIT 1;
  
  RETURN general_centroid;

EXCEPTION
  WHEN OTHERS THEN
    -- Return NULL on any error - hybrid function will handle gracefully
    RETURN NULL;
END;
$$;