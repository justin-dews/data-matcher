const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODA4MzIsImV4cCI6MjA3MTQ1NjgzMn0.B-qWDnZRkxToVhhpMDVgXD38fzOptalciTDHxXOkgHI';

async function debugStorageTest() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🔍 DEBUG: Testing database storage functionality');
  
  try {
    // Test database storage with detailed error capture
    const testProductIds = ['test-product-debug-1', 'test-product-debug-2'];
    const storageTexts = [
      'Debug Test Product 1',
      'Debug Test Product 2'
    ];
    
    const response = await fetch('https://theattidfeqxyaexiqwj.supabase.co/functions/v1/embed-text', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        texts: storageTexts,
        product_ids: testProductIds
      })
    });
    
    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', responseText);
    
    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('✅ Storage test passed!');
      console.log('Success:', data.success);
    } else {
      console.log('❌ Storage test failed');
      try {
        const errorData = JSON.parse(responseText);
        console.log('Error details:', errorData);
      } catch (e) {
        console.log('Could not parse error response as JSON');
      }
    }
    
  } catch (error) {
    console.error('Debug test error:', error);
  }
}

debugStorageTest();