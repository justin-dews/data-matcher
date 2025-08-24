import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface TestRequest {
  test: string;
}

serve(async (req) => {
  console.log('🚀 Test function called:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Content-Type': 'application/json',
      } 
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const body = await req.text();
    console.log('📥 Request body:', body);
    
    const data: TestRequest = JSON.parse(body);
    console.log('✅ Parsed data:', data);

    // Test environment variables
    const envTest = {
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      hasSupabaseKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      hasLlamaParseKey: !!Deno.env.get('LLAMAPARSE_API_KEY')
    };
    
    console.log('🔧 Environment test:', envTest);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Test function works!',
        received: data,
        environment: envTest
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );

  } catch (error) {
    console.error('💥 Error in test function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Test failed',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});