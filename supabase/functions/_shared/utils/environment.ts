// Environment validation utilities

export interface ParsePDFConfig {
  llamaCloudApiKey: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
}

export function validateEnvironment(): ParsePDFConfig {
  const llamaCloudApiKey = Deno.env.get('LLAMA_CLOUD_API_KEY');
  if (!llamaCloudApiKey) {
    throw new Error('LLAMA_CLOUD_API_KEY not configured');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing');
  }

  return {
    llamaCloudApiKey,
    supabaseUrl,
    supabaseServiceKey
  };
}