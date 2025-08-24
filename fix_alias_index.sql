-- Function to create the correct competitor_aliases index
CREATE OR REPLACE FUNCTION create_competitor_alias_index()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- Create the correct index on competitor_name column
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_competitor_aliases_competitor_name_trgm ON competitor_aliases USING gin (competitor_name gin_trgm_ops)';
    
    result := json_build_object(
      'index_created', 'idx_competitor_aliases_competitor_name_trgm',
      'success', true,
      'message', 'Competitor aliases trigram index created successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    result := json_build_object(
      'index_created', null,
      'success', false,
      'error', SQLERRM
    );
  END;

  RETURN result;
END;
$$;