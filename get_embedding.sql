-- Function to get embedding for query text by calling the embed-text edge function
CREATE OR REPLACE FUNCTION get_embedding(input_text TEXT)
RETURNS vector(1536)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
  embedding_result vector(1536);
  api_response jsonb;
  edge_function_url text;
  request_body jsonb;
BEGIN
  -- Handle null/empty input
  IF input_text IS NULL OR trim(input_text) = '' THEN
    RETURN NULL;
  END IF;

  -- Get the edge function URL from environment or use default
  edge_function_url := COALESCE(
    current_setting('app.edge_function_url', true),
    'https://theattidfeqxyaexiqwj.supabase.co/functions/v1/embed-text'
  );

  -- Prepare request body
  request_body := jsonb_build_object(
    'texts', jsonb_build_array(trim(input_text))
  );

  -- Call the edge function using http extension
  SELECT INTO api_response
    content::jsonb
  FROM http((
    'POST',
    edge_function_url,
    ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer ' || current_setting('app.service_role_key', true))
    ],
    request_body::text
  )::http_request);

  -- Check if the request was successful
  IF api_response->>'success' = 'true' AND 
     api_response->'data'->'embeddings' IS NOT NULL AND 
     jsonb_array_length(api_response->'data'->'embeddings') > 0 THEN
    
    -- Extract the first embedding from the response
    embedding_result := (api_response->'data'->'embeddings'->0)::vector(1536);
    
    RETURN embedding_result;
  ELSE
    -- Log error for debugging
    RAISE WARNING 'get_embedding failed for text "%": %', 
      substring(input_text, 1, 50), 
      COALESCE(api_response->>'error', 'Unknown error');
    
    -- Return NULL on failure - the hybrid function can handle this
    RETURN NULL;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error for debugging but don't fail the entire query
    RAISE WARNING 'get_embedding exception for text "%": %', 
      substring(input_text, 1, 50), 
      SQLERRM;
    
    -- Return NULL on any error - the hybrid function will handle missing embeddings
    RETURN NULL;
END;
$$;