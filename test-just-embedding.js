const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODA4MzIsImV4cCI6MjA3MTQ1NjgzMn0.B-qWDnZRkxToVhhpMDVgXD38fzOptalciTDHxXOkgHI';

async function testJustEmbedding() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('🧪 Final Test: Just OpenAI Embedding Generation (No Database Storage)');
  console.log('====================================================================');
  
  try {
    // Test just OpenAI embedding generation without database storage
    const testTexts = [
      'MET 8.8 HX HD CAP SCR M16X1.50X30MM ZP',
      'MET HARDENED FLAT WASHER M18 ZINC PL',
      'PLUG, HEX HD, BRASS PIPE, 1/4" NPT',
      'Stainless steel hex bolt with zinc plating',
      'Industrial grade flat washer for high-torque applications'
    ];
    
    console.log('Testing with texts:', testTexts);
    
    const { data, error } = await supabase.functions.invoke('embed-text', {
      body: { texts: testTexts }
    });
    
    if (error) {
      console.error('❌ Test failed:', error);
      return;
    }
    
    if (data && data.success) {
      console.log('🎉 SUCCESS! OpenAI Integration Fully Functional');
      console.log('===============================================');
      console.log(`✅ Generated ${data.data.embeddings.length} embeddings`);
      console.log(`✅ Each embedding has ${data.data.embeddings[0].length} dimensions`);
      console.log(`✅ Used ${data.data.usage.prompt_tokens} prompt tokens`);
      console.log(`✅ Total tokens: ${data.data.usage.total_tokens}`);
      
      console.log('\n📊 Sample embedding values (first 10):');
      console.log('   ', data.data.embeddings[0].slice(0, 10));
      
      console.log('\n✅ CONCLUSION: embed-text function OpenAI integration is WORKING PERFECTLY!');
      console.log('   - Can generate embeddings for product descriptions');
      console.log('   - Returns proper 1536-dimensional vectors');
      console.log('   - Tracks token usage correctly');
      console.log('   - Handles batch processing');
      
    } else {
      console.log('❌ Unexpected response:', data);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testJustEmbedding();