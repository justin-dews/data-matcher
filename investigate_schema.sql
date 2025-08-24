-- Function to investigate competitor_aliases table schema
CREATE OR REPLACE FUNCTION investigate_competitor_aliases_schema()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  columns_info json;
BEGIN
  -- Get table column information
  SELECT json_agg(
    json_build_object(
      'column_name', column_name,
      'data_type', data_type,
      'is_nullable', is_nullable,
      'column_default', column_default
    )
  ) INTO columns_info
  FROM information_schema.columns 
  WHERE table_name = 'competitor_aliases' 
  AND table_schema = 'public';

  result := json_build_object(
    'table_exists', columns_info IS NOT NULL,
    'columns', COALESCE(columns_info, '[]'::json)
  );

  RETURN result;
END;
$$;