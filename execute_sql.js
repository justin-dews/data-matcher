const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function executeSql() {
  const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co';
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw';

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log('Testing current hybrid_product_match function...');

    // First, let's test the current function to see the error
    const currentTest = await supabase.rpc('hybrid_product_match', {
      query_text: 'test query',
      query_embedding: Array(1536).fill(0.1), // Create proper 1536-dim vector
      org_id: '00000000-0000-0000-0000-000000000000',
      limit_count: 5
    });

    console.log('Current function result:', currentTest);
    
    if (currentTest.error) {
      console.log('Current function has an error:', currentTest.error.message);
      
      // Try to create a fixed version using a stored procedure approach
      console.log('\nAttempting to create helper functions...');
      
      // Since we can't execute DDL directly, let's look at available tables first
      const { data: tables, error: tableError } = await supabase
        .from('products')
        .select('*')
        .limit(1);
        
      if (tableError) {
        console.log('Cannot access products table:', tableError);
      } else {
        console.log('Products table structure sample:', tables);
        
        // Let's try a simple approach: create a test query to see if we can get products
        const { data: products, error: productError } = await supabase
          .from('products')
          .select('id, sku, name, manufacturer')
          .limit(5);
          
        console.log('Products query test:', { data: products, error: productError });
      }
    } else {
      console.log('Function works! Result:', currentTest.data);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

executeSql();