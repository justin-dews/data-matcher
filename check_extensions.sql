-- Check if required extensions are enabled
CREATE OR REPLACE FUNCTION check_required_extensions()
RETURNS TABLE (
  extension_name text,
  is_enabled boolean,
  version text
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ext.extname::text,
    true as is_enabled,
    ext.extversion::text
  FROM pg_extension ext
  WHERE ext.extname IN ('pg_trgm', 'vector')
  
  UNION ALL
  
  SELECT 
    missing.ext_name::text,
    false as is_enabled,
    'not installed'::text
  FROM (VALUES ('pg_trgm'), ('vector')) AS missing(ext_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_extension 
    WHERE extname = missing.ext_name
  );
END;
$$;