#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkFunctions() {
  console.log('🔍 Checking available functions...\n');
  
  try {
    // Check what functions are available
    const { data, error } = await supabase
      .from('pg_proc')
      .select('proname, proargnames, prosrc')
      .like('proname', '%hybrid%product%')
      .limit(5);
      
    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('Available hybrid functions:', data);
    }
    
    // Test the alternate signature mentioned in the error
    console.log('\n🧪 Testing alternate function signature...');
    const { data: matches, error: matchError } = await supabase
      .rpc('hybrid_product_match', {
        query_text: 'GR. 8 HX HD CAP SCR 5/16-18X2-1/2',
        limit_count: 5,
        threshold: 0.1
      });
      
    if (matchError) {
      console.error('❌ Match error:', matchError);
    } else {
      console.log('✅ Function works with alternate signature!');
      console.log('Matches:', matches);
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

checkFunctions();