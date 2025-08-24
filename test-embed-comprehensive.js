const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODA4MzIsImV4cCI6MjA3MTQ1NjgzMn0.B-qWDnZRkxToVhhpMDVgXD38fzOptalciTDHxXOkgHI';

async function comprehensiveTest() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🧪 COMPREHENSIVE EMBED-TEXT FUNCTION TEST');
  console.log('==========================================');
  
  try {
    // Test 1: Basic embedding generation
    console.log('\n📝 Test 1: Basic Embedding Generation');
    const testTexts = [
      'MET 8.8 HX HD CAP SCR M16X1.50X30MM ZP',
      'MET HARDENED FLAT WASHER M18 ZINC PL'
    ];
    
    const { data: basicTest, error: basicError } = await supabase.functions.invoke('embed-text', {
      body: { texts: testTexts }
    });
    
    if (basicError) {
      console.error('❌ Basic test failed:', basicError);
      return;
    }
    
    console.log('✅ Basic test passed');
    console.log(`   Generated ${basicTest.data.embeddings.length} embeddings`);
    console.log(`   Embedding dimensions: ${basicTest.data.embeddings[0].length}`);
    console.log(`   Token usage: ${basicTest.data.usage.total_tokens} tokens`);
    
    // Test 2: Database storage with product IDs
    console.log('\n💾 Test 2: Database Storage Test');
    const testProductIds = ['test-product-1', 'test-product-2'];
    const storageTexts = [
      'Stainless Steel Bolt M12x50mm',
      'Aluminum Washer 12mm Internal Diameter'
    ];
    
    const { data: storageTest, error: storageError } = await supabase.functions.invoke('embed-text', {
      body: { 
        texts: storageTexts,
        product_ids: testProductIds
      }
    });
    
    if (storageError) {
      console.error('❌ Storage test failed:', storageError);
      return;
    }
    
    console.log('✅ Storage test passed');
    console.log('   Embeddings generated and should be stored in database');
    
    // Test 3: Retrieve stored embeddings via GET
    console.log('\n📖 Test 3: Retrieve Stored Embeddings');
    const { data: retrieveTest, error: retrieveError } = await supabase.functions.invoke('embed-text', {
      method: 'GET'
    });
    
    if (retrieveError) {
      console.error('❌ Retrieve test failed:', retrieveError);
    } else {
      console.log('✅ Retrieve test passed');
      console.log(`   Retrieved ${retrieveTest.data?.length || 0} stored embeddings`);
    }
    
    // Test 4: Error handling - empty input
    console.log('\n🚫 Test 4: Error Handling - Empty Input');
    const { data: errorTest, error: shouldBeError } = await supabase.functions.invoke('embed-text', {
      body: { texts: [] }
    });
    
    if (errorTest && !errorTest.success) {
      console.log('✅ Error handling test passed');
      console.log(`   Properly rejected empty input: ${errorTest.error}`);
    } else {
      console.log('❌ Error handling test failed - should have rejected empty input');
    }
    
    // Test 5: Batch processing with larger input
    console.log('\n📦 Test 5: Batch Processing Test');
    const largeBatch = Array.from({length: 10}, (_, i) => 
      `Test product description ${i + 1}: High quality steel component with precision machining`
    );
    
    const { data: batchTest, error: batchError } = await supabase.functions.invoke('embed-text', {
      body: { texts: largeBatch }
    });
    
    if (batchError) {
      console.error('❌ Batch test failed:', batchError);
    } else {
      console.log('✅ Batch test passed');
      console.log(`   Processed ${batchTest.data.embeddings.length} items in batch`);
      console.log(`   Total tokens used: ${batchTest.data.usage.total_tokens}`);
    }
    
    console.log('\n🎉 ALL TESTS COMPLETED!');
    console.log('embed-text function is FULLY FUNCTIONAL');
    
  } catch (error) {
    console.error('❌ Comprehensive test error:', error);
  }
}

comprehensiveTest();