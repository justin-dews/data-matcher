-- Test function to verify required extensions
CREATE OR REPLACE FUNCTION test_extensions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  pg_trgm_enabled boolean := false;
  vector_enabled boolean := false;
  pg_trgm_version text := 'not installed';
  vector_version text := 'not installed';
BEGIN
  -- Check pg_trgm extension
  BEGIN
    SELECT true, extversion INTO pg_trgm_enabled, pg_trgm_version
    FROM pg_extension 
    WHERE extname = 'pg_trgm';
    
    IF NOT FOUND THEN
      pg_trgm_enabled := false;
      pg_trgm_version := 'not installed';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    pg_trgm_enabled := false;
    pg_trgm_version := 'error checking';
  END;

  -- Check vector extension  
  BEGIN
    SELECT true, extversion INTO vector_enabled, vector_version
    FROM pg_extension 
    WHERE extname = 'vector';
    
    IF NOT FOUND THEN
      vector_enabled := false;
      vector_version := 'not installed';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    vector_enabled := false;
    vector_version := 'error checking';
  END;

  -- Test trigram similarity function if available
  IF pg_trgm_enabled THEN
    BEGIN
      PERFORM similarity('test', 'testing');
    EXCEPTION WHEN OTHERS THEN
      pg_trgm_enabled := false;
      pg_trgm_version := 'installed but not working';
    END;
  END IF;

  result := json_build_object(
    'pg_trgm', json_build_object(
      'enabled', pg_trgm_enabled,
      'version', pg_trgm_version
    ),
    'vector', json_build_object(
      'enabled', vector_enabled, 
      'version', vector_version
    )
  );

  RETURN result;
END;
$$;