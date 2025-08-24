const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODA4MzIsImV4cCI6MjA3MTQ1NjgzMn0.B-qWDnZRkxToVhhpMDVgXD38fzOptalciTDHxXOkgHI';

async function testEmbedFunction() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    console.log('Testing embed-text edge function...');
    
    // Test with some sample product descriptions
    const testTexts = [
      'MET 8.8 HX HD CAP SCR M16X1.50X30MM ZP',
      'MET HARDENED FLAT WASHER M18 ZINC PL',
      'PLUG, HEX HD, BRASS PIPE, 1/4" NPT',
    ];
    
    const { data, error } = await supabase.functions.invoke('embed-text', {
      body: {
        texts: testTexts
      }
    });
    
    if (error) {
      console.error('Edge function error:', error);
      return;
    }
    
    console.log('Success:', data.success);
    if (data.success && data.data) {
      console.log('Generated embeddings:', data.data.embeddings.length);
      console.log('First embedding length:', data.data.embeddings[0]?.length);
      console.log('Usage:', data.data.usage);
      
      // Show first few values of first embedding
      if (data.data.embeddings[0]) {
        console.log('First embedding preview:', data.data.embeddings[0].slice(0, 5), '...');
      }
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testEmbedFunction();