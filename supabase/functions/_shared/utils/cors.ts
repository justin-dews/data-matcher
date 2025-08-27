// CORS utilities for edge functions

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function createCORSResponse(data: any, status = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

export function createErrorResponse(error: string, status = 500): Response {
  return createCORSResponse(
    { 
      error,
      success: false 
    },
    status
  );
}

export function handleCORSPreflight(): Response {
  return new Response(null, { headers: corsHeaders });
}