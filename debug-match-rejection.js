#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = 'b903b88d-e667-4dde-94ff-79dbbb1fcb38'; // Justin's user ID

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function debugMatchRejection() {
  console.log('🔍 Debugging match rejection error for POWER NUTSETTER item...\n');
  
  try {
    // 1. Find the line item containing "POWER NUTSETTER"
    console.log('1️⃣ Finding the POWER NUTSETTER line item...');
    const { data: lineItems, error: lineItemError } = await supabase
      .from('line_items')
      .select('*')
      .eq('organization_id', ORG_ID)
      .ilike('raw_text', '%POWER NUTSETTER%');
      
    if (lineItemError) {
      console.error('❌ Error fetching line items:', lineItemError);
      return;
    }
    
    if (!lineItems || lineItems.length === 0) {
      console.log('❌ No POWER NUTSETTER line items found');
      return;
    }
    
    const targetLineItem = lineItems[0];
    console.log(`✅ Found line item: ${targetLineItem.id}`);
    console.log(`   Raw text: "${targetLineItem.raw_text}"`);
    console.log(`   Parsed name: "${targetLineItem.parsed_data?.name || 'N/A'}"`);
    
    // 2. Check if there's already a match record
    console.log('\n2️⃣ Checking existing match record...');
    const { data: existingMatches, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('line_item_id', targetLineItem.id);
      
    if (matchError) {
      console.error('❌ Error checking existing matches:', matchError);
    } else {
      console.log(`Found ${existingMatches?.length || 0} existing match records`);
      if (existingMatches && existingMatches.length > 0) {
        existingMatches.forEach((match, i) => {
          console.log(`   ${i + 1}. Status: ${match.status}, Product ID: ${match.product_id}`);
        });
      }
    }
    
    // 3. Try the exact same upsert operation from the handleMatchRejection function
    console.log('\n3️⃣ Testing the upsert operation that should create/update rejection...');
    
    const upsertData = {
      line_item_id: targetLineItem.id,
      product_id: null,
      organization_id: ORG_ID,
      status: 'rejected',
      reviewed_by: USER_ID,
      reviewed_at: new Date().toISOString()
    };
    
    console.log('Upsert data:', upsertData);
    
    const { data: upsertResult, error: upsertError } = await supabase
      .from('matches')
      .upsert(upsertData, {
        onConflict: 'line_item_id'
      })
      .select();
      
    if (upsertError) {
      console.error('❌ UPSERT ERROR:', upsertError);
      console.error('   Code:', upsertError.code);
      console.error('   Details:', upsertError.details);
      console.error('   Hint:', upsertError.hint);
      console.error('   Message:', upsertError.message);
    } else {
      console.log('✅ Upsert successful:', upsertResult);
    }
    
    // 4. Check the matches table schema to see if there are any constraints
    console.log('\n4️⃣ Checking matches table structure...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('information_schema.columns')
      .select('column_name, is_nullable, column_default, data_type')
      .eq('table_name', 'matches')
      .eq('table_schema', 'public');
      
    if (tableError) {
      console.error('❌ Error getting table info:', tableError);
    } else {
      console.log('Matches table columns:');
      tableInfo?.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }
    
    // 5. Check RLS policies on matches table
    console.log('\n5️⃣ Testing if RLS policies allow this operation...');
    
    // Test a simple select to see if RLS is working
    const { data: rlsTest, error: rlsError } = await supabase
      .from('matches')
      .select('count', { count: 'exact', head: true })
      .eq('organization_id', ORG_ID);
      
    if (rlsError) {
      console.error('❌ RLS test error:', rlsError);
      console.log('   This suggests RLS policies might be blocking the operation');
    } else {
      console.log(`✅ RLS test passed - can access ${rlsTest?.length || 0} records`);
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error.message);
  }
}

// Run with environment variable
if (require.main === module) {
  debugMatchRejection().then(() => {
    console.log('\n✅ Debug complete');
  }).catch(err => {
    console.error('💥 Debug failed:', err);
  });
}

module.exports = { debugMatchRejection };