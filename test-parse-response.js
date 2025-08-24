const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODA4MzIsImV4cCI6MjA3MTQ1NjgzMn0.B-qWDnZRkxToVhhpMDVgXD38fzOptalciTDHxXOkgHI';

async function testParseFunction() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    console.log('Calling parse-pdf edge function...');
    
    const { data, error } = await supabase.functions.invoke('parse-pdf', {
      body: {
        storagePath: 'b903b88d-e667-4dde-94ff-79dbbb1fcb38/1755917000363-Quote1.pdf'
      }
    });
    
    if (error) {
      console.error('Edge function error:', error);
      return;
    }
    
    console.log('Success:', data.success);
    console.log('Total line items:', data.lineItems?.length);
    
    if (data.lineItems && data.lineItems.length > 0) {
      console.log('\nFirst few line items:');
      for (let i = 0; i < Math.min(3, data.lineItems.length); i++) {
        const item = data.lineItems[i];
        console.log(`${i + 1}. item_number: "${item.item_number}"`);
        console.log(`   part_number: "${item.part_number}"`);
        console.log(`   description: "${item.description}"`);
        console.log(`   raw_row: "${item.raw_row}"`);
        console.log('---');
      }
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testParseFunction();