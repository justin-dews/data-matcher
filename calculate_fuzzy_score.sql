-- Function to calculate fuzzy similarity score using multiple PostgreSQL string functions
CREATE OR REPLACE FUNCTION calculate_fuzzy_score(text1 TEXT, text2 TEXT)
RETURNS FLOAT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  levenshtein_score FLOAT;
  word_overlap_score FLOAT;
  substring_score FLOAT;
  final_score FLOAT;
  max_length INTEGER;
  distance INTEGER;
  words1 TEXT[];
  words2 TEXT[];
  common_words INTEGER;
  total_words INTEGER;
  longer_text TEXT;
  shorter_text TEXT;
BEGIN
  -- Handle null or empty inputs
  IF text1 IS NULL OR text2 IS NULL OR 
     trim(text1) = '' OR trim(text2) = '' THEN
    RETURN 0.0;
  END IF;

  -- Normalize inputs (use our normalize function for consistency)
  text1 := normalize_product_text(text1);
  text2 := normalize_product_text(text2);

  -- If texts are identical after normalization, return perfect score
  IF text1 = text2 THEN
    RETURN 1.0;
  END IF;

  -- 1. LEVENSHTEIN DISTANCE SCORE (50% weight)
  max_length := GREATEST(length(text1), length(text2));
  
  -- Handle case where one text is much longer to avoid artificially low scores
  IF max_length = 0 THEN
    levenshtein_score := 1.0;
  ELSE
    distance := levenshtein(text1, text2);
    levenshtein_score := 1.0 - (distance::FLOAT / max_length::FLOAT);
    -- Ensure score is between 0 and 1
    levenshtein_score := GREATEST(0.0, LEAST(1.0, levenshtein_score));
  END IF;

  -- 2. WORD-LEVEL MATCHING SCORE (30% weight)
  -- Split texts into word arrays
  words1 := string_to_array(text1, ' ');
  words2 := string_to_array(text2, ' ');
  
  -- Remove empty elements
  words1 := array_remove(words1, '');
  words2 := array_remove(words2, '');
  
  -- Count common words
  common_words := 0;
  FOR i IN 1..array_length(words1, 1) LOOP
    IF words1[i] = ANY(words2) THEN
      common_words := common_words + 1;
    END IF;
  END LOOP;
  
  total_words := GREATEST(array_length(words1, 1), array_length(words2, 1));
  
  IF total_words = 0 THEN
    word_overlap_score := 1.0;
  ELSE
    word_overlap_score := common_words::FLOAT / total_words::FLOAT;
  END IF;

  -- 3. SUBSTRING MATCHING SCORE (20% weight)
  -- Check for longest common substring
  longer_text := CASE WHEN length(text1) >= length(text2) THEN text1 ELSE text2 END;
  shorter_text := CASE WHEN length(text1) < length(text2) THEN text1 ELSE text2 END;
  
  -- Simple substring matching: check if shorter text is contained in longer text
  IF position(shorter_text in longer_text) > 0 THEN
    substring_score := length(shorter_text)::FLOAT / length(longer_text)::FLOAT;
  ELSE
    -- Optimized partial substring matching: check key substrings only
    substring_score := 0.0;
    IF length(shorter_text) >= 3 THEN
      -- Check decreasing substring lengths starting from the longest
      -- This is much more efficient than nested loops
      FOR substring_len IN REVERSE LEAST(length(shorter_text), 10)..3 LOOP
        FOR start_pos IN 1..(length(shorter_text) - substring_len + 1) LOOP
          IF position(substring(shorter_text, start_pos, substring_len) in longer_text) > 0 THEN
            substring_score := substring_len::FLOAT / length(longer_text)::FLOAT;
            EXIT; -- Found longest match, no need to continue
          END IF;
        END LOOP;
        -- If we found a match, exit the outer loop too
        IF substring_score > 0.0 THEN
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  -- Ensure substring score is between 0 and 1
  substring_score := GREATEST(0.0, LEAST(1.0, substring_score));

  -- 4. COMBINE SCORES WITH WEIGHTS (50% + 30% + 20% = 100%)
  final_score := (levenshtein_score * 0.5) + (word_overlap_score * 0.3) + (substring_score * 0.2);
  
  -- Ensure final score is between 0 and 1
  final_score := GREATEST(0.0, LEAST(1.0, final_score));

  RETURN final_score;
END;
$$;