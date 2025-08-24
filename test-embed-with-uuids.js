const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODA4MzIsImV4cCI6MjA3MTQ1NjgzMn0.B-qWDnZRkxToVhhpMDVgXD38fzOptalciTDHxXOkgHI';

// Helper function to generate UUIDs
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function testWithValidUUIDs() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🧪 Testing embed-text with valid UUIDs');
  console.log('====================================');
  
  try {
    // Generate valid UUIDs for testing
    const testProductIds = [generateUUID(), generateUUID()];
    const storageTexts = [
      'High-quality steel bolt with corrosion resistance',
      'Precision-machined aluminum washer for industrial use'
    ];
    
    console.log('Test product IDs:', testProductIds);
    console.log('Test texts:', storageTexts);
    
    const { data, error } = await supabase.functions.invoke('embed-text', {
      body: { 
        texts: storageTexts,
        product_ids: testProductIds
      }
    });
    
    if (error) {
      console.error('❌ Test failed:', error);
      return;
    }
    
    if (data && data.success) {
      console.log('✅ SUCCESS! Database storage test passed');
      console.log(`   Generated ${data.data.embeddings.length} embeddings`);
      console.log(`   Embedding dimensions: ${data.data.embeddings[0].length}`);
      console.log(`   Token usage: ${data.data.usage.total_tokens} tokens`);
      console.log('   Embeddings should now be stored in product_embeddings table');
      
      // Test retrieval
      console.log('\n📖 Testing retrieval of stored embeddings...');
      const { data: retrieveData, error: retrieveError } = await supabase.functions.invoke('embed-text', {
        method: 'GET'
      });
      
      if (retrieveError) {
        console.error('❌ Retrieval failed:', retrieveError);
      } else {
        console.log(`✅ Retrieved ${retrieveData.data?.length || 0} stored embeddings from database`);
        if (retrieveData.data && retrieveData.data.length > 0) {
          console.log('   Sample retrieved embedding:', {
            product_id: retrieveData.data[0].product_id,
            text_content: retrieveData.data[0].text_content?.substring(0, 50) + '...',
            embedding_length: retrieveData.data[0].embedding?.length
          });
        }
      }
      
    } else {
      console.log('❌ Test failed with response:', data);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testWithValidUUIDs();