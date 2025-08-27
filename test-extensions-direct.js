#!/usr/bin/env node

/**
 * Direct test of PostgreSQL extensions using Supabase RPC
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testExtensions() {
  console.log('🔍 Testing PostgreSQL Extensions...\n');
  
  try {
    // Test the correct function that exists in your database
    const { data, error } = await supabase
      .rpc('hybrid_product_match_tiered', {
        query_text: 'test product',
        limit_count: 1,
        threshold: 0.2
      });
    
    if (error) {
      console.error('❌ Extension test via hybrid_product_match failed:');
      console.error('   Error:', error.message);
      console.error('   Details:', error.details);
      console.error('   Hint:', error.hint);
      
      if (error.message.includes('similarity')) {
        console.error('\n💡 This confirms pg_trgm similarity() function is not available');
        console.error('   Need to fix extension schema placement');
      }
    } else {
      console.log('✅ Extensions working - hybrid_product_match executed successfully');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testExtensions();