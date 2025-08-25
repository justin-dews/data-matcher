-- Enhanced Learned Similarity Boost Function for ML-Enhanced Matching
-- This function uses approved match training data to boost similar queries

CREATE OR REPLACE FUNCTION get_learned_similarity_boost(
  p_query_text TEXT,
  p_product_id UUID,
  p_org_id UUID
) RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  best_learned_score DOUBLE PRECISION := 0.0;
  training_record RECORD;
  text_similarity DOUBLE PRECISION;
  weighted_score DOUBLE PRECISION;
  record_count INTEGER := 0;
  total_weighted_score DOUBLE PRECISION := 0.0;
BEGIN
  -- Handle null inputs
  IF p_query_text IS NULL OR p_product_id IS NULL OR p_org_id IS NULL THEN
    RETURN 0.0;
  END IF;
  
  -- Normalize the input query
  p_query_text := lower(trim(regexp_replace(p_query_text, '\s+', ' ', 'g')));
  
  -- If query is too short, don't use learned similarity
  IF length(p_query_text) < 3 THEN
    RETURN 0.0;
  END IF;
  
  -- Find similar approved matches for this product
  FOR training_record IN
    SELECT 
      mtd.line_item_text,
      mtd.line_item_normalized,
      mtd.match_quality,
      mtd.match_confidence,
      mtd.training_weight,
      mtd.final_score,
      mtd.times_referenced,
      EXTRACT(EPOCH FROM (now() - mtd.approved_at)) / 86400.0 AS days_ago
    FROM match_training_data mtd
    WHERE mtd.matched_product_id = p_product_id 
      AND mtd.organization_id = p_org_id
      AND mtd.match_quality IN ('excellent', 'good') -- Only use high-quality training data
      AND mtd.approved_at >= (now() - INTERVAL '6 months') -- Only recent matches
    ORDER BY mtd.match_confidence DESC, mtd.approved_at DESC
    LIMIT 20 -- Limit to most relevant training examples
  LOOP
    -- Calculate text similarity between query and training example
    text_similarity := GREATEST(
      -- Trigram similarity with normalized text
      similarity(p_query_text, training_record.line_item_normalized),
      -- Trigram similarity with original text
      similarity(p_query_text, lower(training_record.line_item_text)),
      -- Fuzzy similarity (custom function)
      calculate_fuzzy_score(p_query_text, training_record.line_item_text)
    );
    
    -- Only consider if there's meaningful similarity
    IF text_similarity >= 0.3 THEN
      -- Calculate weighted score based on multiple factors
      weighted_score := text_similarity;
      
      -- Boost for match quality
      CASE training_record.match_quality
        WHEN 'excellent' THEN weighted_score := weighted_score * 1.2;
        WHEN 'good' THEN weighted_score := weighted_score * 1.1;
        ELSE weighted_score := weighted_score * 1.0;
      END CASE;
      
      -- Boost for high original confidence
      IF training_record.match_confidence > 0.8 THEN
        weighted_score := weighted_score * 1.1;
      END IF;
      
      -- Slight decay for older matches (prefer recent patterns)
      IF training_record.days_ago > 90 THEN
        weighted_score := weighted_score * (1.0 - (training_record.days_ago - 90) / 365.0);
      END IF;
      
      -- Apply training weight (allows manual adjustment)
      weighted_score := weighted_score * training_record.training_weight;
      
      -- Accumulate weighted scores
      total_weighted_score := total_weighted_score + weighted_score;
      record_count := record_count + 1;
      
      -- Track the best individual match
      best_learned_score := GREATEST(best_learned_score, weighted_score);
    END IF;
  END LOOP;
  
  -- Calculate final learned similarity score
  IF record_count > 0 THEN
    -- Use weighted average of top matches, capped at reasonable maximum
    DECLARE
      avg_score DOUBLE PRECISION := total_weighted_score / record_count;
      final_score DOUBLE PRECISION;
    BEGIN
      -- Blend best individual score with average (70% best, 30% average)
      final_score := (best_learned_score * 0.7) + (avg_score * 0.3);
      
      -- Apply diminishing returns to prevent over-weighting
      final_score := final_score * (1.0 - EXP(-record_count::DOUBLE PRECISION / 5.0));
      
      -- Ensure score is reasonable (max 0.95 to leave room for other factors)
      final_score := LEAST(0.95, final_score);
      
      -- Update reference counter for the training data (async, don't fail on error)
      BEGIN
        UPDATE match_training_data 
        SET times_referenced = times_referenced + 1,
            last_referenced_at = now()
        WHERE matched_product_id = p_product_id 
          AND organization_id = p_org_id
          AND similarity(line_item_normalized, p_query_text) >= 0.3;
      EXCEPTION
        WHEN OTHERS THEN
          -- Ignore errors in reference counting
          NULL;
      END;
      
      RETURN final_score;
    END;
  END IF;
  
  -- No similar training data found
  RETURN 0.0;
  
EXCEPTION
  WHEN OTHERS THEN
    -- On any error, return 0 (graceful degradation)
    RETURN 0.0;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_learned_similarity_boost(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_learned_similarity_boost(TEXT, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_learned_similarity_boost(TEXT, UUID, UUID) TO anon;

-- Add comment
COMMENT ON FUNCTION get_learned_similarity_boost(TEXT, UUID, UUID) IS 
'Machine learning enhanced similarity boost based on approved match training data. Uses historical patterns to improve matching accuracy.';

SELECT 'Created get_learned_similarity_boost function for ML-enhanced matching!' AS status;