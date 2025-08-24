const { createClient } = require('@supabase/supabase-js');

async function fixFunction() {
  const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co';
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw';

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Let's try to call the function with proper fully qualified column names
  // by testing a simpler version first
  try {
    console.log('Creating a simple test function...');
    
    // Try to create a simple function that works
    const result = await supabase.rpc('sql', {
      query: `
        DROP FUNCTION IF EXISTS test_products;
        CREATE OR REPLACE FUNCTION test_products(org_id UUID)
        RETURNS TABLE (
            product_id UUID,
            product_sku TEXT,
            product_name TEXT
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                products.id,
                products.sku,
                products.name
            FROM products
            WHERE products.organization_id = org_id
            LIMIT 5;
        END;
        $$ LANGUAGE plpgsql;
      `
    });

    console.log('Test function creation result:', result);

    if (!result.error) {
      // Test the new function
      const testResult = await supabase.rpc('test_products', {
        org_id: '00000000-0000-0000-0000-000000000000'
      });
      console.log('Test function result:', testResult);
    }

    // Now try to fix the actual hybrid function with proper aliases
    console.log('\nNow fixing the hybrid function...');
    
    const fixResult = await supabase.rpc('sql', {
      query: `
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
                products.id AS product_id,
                products.sku AS sku,
                products.name AS name,
                products.manufacturer AS manufacturer,
                similarity(products.name, query_text)::DECIMAL AS final_score
            FROM products
            WHERE products.organization_id = org_id
              AND similarity(products.name, query_text) > 0.1
            ORDER BY similarity(products.name, query_text) DESC
            LIMIT limit_count;
        END;
        $$ LANGUAGE plpgsql;
      `
    });

    console.log('Fix function result:', fixResult);

    if (!fixResult.error) {
      // Test the fixed function
      const finalTest = await supabase.rpc('hybrid_product_match', {
        query_text: 'test query',
        query_embedding: Array(1536).fill(0.1),
        org_id: '00000000-0000-0000-0000-000000000000',
        limit_count: 5
      });
      console.log('Final test result:', finalTest);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

fixFunction();