-- Final fixed function to normalize product text for consistent matching
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

  -- Normalize common abbreviations BEFORE removing special chars
  normalized_text := regexp_replace(normalized_text, 'w/', 'with', 'g');
  normalized_text := regexp_replace(normalized_text, '&', ' and ', 'g');

  -- Clean up hyphens BEFORE word boundary matching
  normalized_text := regexp_replace(normalized_text, '-+', ' ', 'g');
  
  -- Clean whitespace again
  normalized_text := regexp_replace(normalized_text, '\s+', ' ', 'g');
  normalized_text := trim(normalized_text);

  -- Now normalize hardware terms with proper word boundaries
  normalized_text := regexp_replace(normalized_text, '\mhx\M', 'hex', 'g');
  normalized_text := regexp_replace(normalized_text, '\mhd\M', 'head', 'g');
  normalized_text := regexp_replace(normalized_text, '\mscr\M', 'screw', 'g');
  normalized_text := regexp_replace(normalized_text, '\mzp\M', 'zinc plated', 'g');

  -- Handle combinations
  normalized_text := regexp_replace(normalized_text, 'cap head', 'cap head', 'g');
  normalized_text := regexp_replace(normalized_text, 'hex head', 'hex head', 'g');

  -- Normalize material abbreviations  
  normalized_text := regexp_replace(normalized_text, '\mss\M', 'stainless steel', 'g');
  normalized_text := regexp_replace(normalized_text, 'st steel', 'stainless steel', 'g');
  normalized_text := regexp_replace(normalized_text, 'stainless st', 'stainless steel', 'g');
  normalized_text := regexp_replace(normalized_text, '\malum\M', 'aluminum', 'g');
  normalized_text := regexp_replace(normalized_text, 'zinc pl', 'zinc plated', 'g');

  -- Remove remaining special characters but keep important ones for part numbers
  -- Keep: letters, numbers, spaces, periods, forward slashes
  normalized_text := regexp_replace(normalized_text, '[^a-z0-9\s\./]', ' ', 'g');

  -- Final whitespace cleanup
  normalized_text := regexp_replace(normalized_text, '\s+', ' ', 'g');
  normalized_text := trim(normalized_text);

  RETURN normalized_text;
END;
$$;