#!/usr/bin/env node

/**
 * Test script to debug the parse-pdf edge function
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://theattidfeqxyaexiqwj.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testParseFunction() {
  console.log('🧪 Testing parse-pdf edge function...');
  
  try {
    // Test with minimal payload
    const { data, error } = await supabase.functions.invoke('parse-pdf', {
      body: {
        document_id: '00000000-0000-0000-0000-000000000001',
        file_path: 'test.pdf',
        preset: 'invoice'
      }
    });
    
    console.log('Response data:', data);
    console.log('Response error:', error);
    
    if (error) {
      console.error('❌ Edge function failed:', error);
    } else {
      console.log('✅ Edge function responded successfully');
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
}

testParseFunction();