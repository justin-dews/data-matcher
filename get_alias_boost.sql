-- Function to get alias boost score for competitor product matching
CREATE OR REPLACE FUNCTION get_alias_boost(
  competitor_product TEXT,
  target_product_id UUID,
  org_id UUID
)
RETURNS FLOAT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  alias_score FLOAT := 0.0;
  normalized_competitor TEXT;
  alias_record RECORD;
  match_found BOOLEAN := FALSE;
BEGIN
  -- Handle null inputs
  IF competitor_product IS NULL OR target_product_id IS NULL OR org_id IS NULL THEN
    RETURN 0.0;
  END IF;
  
  -- Normalize the competitor product text for consistent matching
  normalized_competitor := normalize_product_text(competitor_product);
  
  -- Return 0 if normalization resulted in empty string
  IF normalized_competitor = '' OR trim(normalized_competitor) = '' THEN
    RETURN 0.0;
  END IF;
  
  -- Look for exact alias match first (highest confidence)
  SELECT ca.confidence_score INTO alias_score
  FROM competitor_aliases ca
  WHERE ca.organization_id = org_id
    AND ca.product_id = target_product_id
    AND normalize_product_text(ca.competitor_name) = normalized_competitor
  ORDER BY ca.confidence_score DESC, ca.created_at DESC
  LIMIT 1;
  
  IF FOUND AND alias_score IS NOT NULL THEN
    -- Found exact match, return the confidence score
    RETURN GREATEST(0.0, LEAST(1.0, alias_score));
  END IF;
  
  -- If no exact match, look for partial matches using fuzzy matching
  -- Only consider aliases with reasonable confidence (>= 0.5)
  FOR alias_record IN
    SELECT 
      ca.competitor_name,
      ca.confidence_score,
      calculate_fuzzy_score(normalized_competitor, normalize_product_text(ca.competitor_name)) as fuzzy_similarity
    FROM competitor_aliases ca
    WHERE ca.organization_id = org_id
      AND ca.product_id = target_product_id
      AND ca.confidence_score >= 0.5
    ORDER BY ca.confidence_score DESC, ca.created_at DESC
  LOOP
    -- If fuzzy similarity is high enough (>= 0.8), use a weighted score
    IF alias_record.fuzzy_similarity >= 0.8 THEN
      -- Weight the alias confidence by the fuzzy similarity
      alias_score := GREATEST(alias_score, alias_record.confidence_score * alias_record.fuzzy_similarity * 0.8);
      match_found := TRUE;
    END IF;
  END LOOP;
  
  -- Ensure score is between 0 and 1
  alias_score := GREATEST(0.0, LEAST(1.0, alias_score));
  
  RETURN alias_score;
END;
$$;