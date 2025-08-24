import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    console.log('Attempting to fix hybrid_product_match function...')

    // Execute the SQL to fix the function
    const { data, error } = await supabaseAdmin.rpc('exec', {
      sql: `
        -- Quick fix for hybrid function
        DROP FUNCTION IF EXISTS hybrid_product_match;

        CREATE OR REPLACE FUNCTION hybrid_product_match(
            query_text TEXT,
            query_embedding vector(1536),
            org_id UUID,
            limit_count INTEGER DEFAULT 10
        )
        RETURNS TABLE (
            product_id UUID,
            sku TEXT,
            name TEXT,
            manufacturer TEXT,
            final_score DECIMAL
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                p.id,
                p.sku,
                p.name,
                p.manufacturer,
                similarity(p.name, query_text)::DECIMAL AS score
            FROM products p
            WHERE p.organization_id = org_id
              AND similarity(p.name, query_text) > 0.1
            ORDER BY score DESC
            LIMIT limit_count;
        END;
        $$ LANGUAGE plpgsql;
      `
    })

    if (error) {
      console.error('Error executing SQL:', error)
      return new Response(
        JSON.stringify({ error: error.message }), 
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Test the function
    const testResult = await supabaseAdmin.rpc('hybrid_product_match', {
      query_text: 'test query',
      query_embedding: Array(1536).fill(0.1),
      org_id: '00000000-0000-0000-0000-000000000000',
      limit_count: 5
    })

    return new Response(
      JSON.stringify({ 
        message: 'Function fixed successfully',
        sqlResult: data,
        testResult: testResult
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})