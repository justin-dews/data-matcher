-- Fixed function to normalize product text for consistent matching
CREATE OR REPLACE FUNCTION normalize_product_text(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized_text TEXT;
BEGIN
  -- Handle null or empty input
  IF input_text IS NULL OR trim(input_text) = '' THEN
    RETURN '';
  END IF;

  -- Start with the input text
  normalized_text := input_text;

  -- Convert to lowercase
  normalized_text := lower(normalized_text);

  -- Remove extra whitespace and trim
  normalized_text := regexp_replace(normalized_text, '\s+', ' ', 'g');
  normalized_text := trim(normalized_text);

  -- Normalize common abbreviations (fix word boundaries)
  normalized_text := regexp_replace(normalized_text, 'w/', 'with', 'g');
  normalized_text := regexp_replace(normalized_text, '\band\b', 'and', 'g'); -- & handled below
  normalized_text := regexp_replace(normalized_text, '&', ' and ', 'g');

  -- Normalize hardware terms (fix word boundaries for abbreviations)
  normalized_text := regexp_replace(normalized_text, '\bhx\b', 'hex', 'g');
  normalized_text := regexp_replace(normalized_text, '\bhd\b', 'head', 'g');
  normalized_text := regexp_replace(normalized_text, '\bscr\b', 'screw', 'g');
  normalized_text := regexp_replace(normalized_text, '\bcap hd\b', 'cap head', 'g');
  normalized_text := regexp_replace(normalized_text, '\bhex hd\b', 'hex head', 'g');

  -- Normalize material abbreviations  
  normalized_text := regexp_replace(normalized_text, '\bzp\b', 'zinc plated', 'g');
  normalized_text := regexp_replace(normalized_text, '\bzinc pl\b', 'zinc plated', 'g');
  normalized_text := regexp_replace(normalized_text, '\bss\b', 'stainless steel', 'g');
  normalized_text := regexp_replace(normalized_text, '\bst steel\b', 'stainless steel', 'g');
  normalized_text := regexp_replace(normalized_text, '\bstainless st\b', 'stainless steel', 'g');
  normalized_text := regexp_replace(normalized_text, '\balum\b', 'aluminum', 'g');

  -- Clean up multiple hyphens and normalize spacing around them
  normalized_text := regexp_replace(normalized_text, '-+', '-', 'g');
  normalized_text := regexp_replace(normalized_text, '\s*-\s*', ' ', 'g');

  -- Remove special characters but keep important ones for part numbers
  -- Keep: letters, numbers, spaces, periods, forward slashes
  normalized_text := regexp_replace(normalized_text, '[^a-z0-9\s\./]', ' ', 'g');

  -- Final whitespace cleanup
  normalized_text := regexp_replace(normalized_text, '\s+', ' ', 'g');
  normalized_text := trim(normalized_text);

  RETURN normalized_text;
END;
$$;