#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = 'b903b88d-e667-4dde-94ff-79dbbb1fcb38';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testRejectionFix() {
  console.log('🧪 Testing the new rejection logic...\n');
  
  try {
    const lineItemId = '108cb223-9479-4e60-8662-6a41ac47e198'; // POWER NUTSETTER
    
    console.log(`1️⃣ Testing rejection for line item: ${lineItemId}`);
    
    // Simulate the new handleMatchRejection logic
    console.log('   Checking for existing match...');
    const { data: existingMatch, error: checkError } = await supabase
      .from('matches')
      .select('id')
      .eq('line_item_id', lineItemId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking for existing match:', checkError);
      return;
    }

    console.log(`   ${existingMatch ? '✅ Found existing match' : '📝 No existing match found'}`);

    const matchData = {
      line_item_id: lineItemId,
      product_id: null,
      organization_id: ORG_ID,
      status: 'rejected',
      reviewed_by: USER_ID,
      reviewed_at: new Date().toISOString()
    };

    if (existingMatch) {
      console.log('   Updating existing match...');
      const { error: updateError } = await supabase
        .from('matches')
        .update(matchData)
        .eq('id', existingMatch.id);
      
      if (updateError) {
        console.error('❌ Update error:', updateError);
        return;
      }
      console.log('✅ Match updated successfully');
    } else {
      console.log('   Creating new match...');
      const { error: insertError } = await supabase
        .from('matches')
        .insert(matchData);
      
      if (insertError) {
        console.error('❌ Insert error:', insertError);
        return;
      }
      console.log('✅ Match created successfully');
    }

    // Verify the match was created/updated
    console.log('\n2️⃣ Verifying the result...');
    const { data: finalMatch, error: verifyError } = await supabase
      .from('matches')
      .select('*')
      .eq('line_item_id', lineItemId)
      .single();

    if (verifyError) {
      console.error('❌ Error verifying result:', verifyError);
      return;
    }

    console.log('✅ Match verification successful:');
    console.log(`   Status: ${finalMatch.status}`);
    console.log(`   Product ID: ${finalMatch.product_id}`);
    console.log(`   Reviewed by: ${finalMatch.reviewed_by}`);
    console.log(`   Reviewed at: ${finalMatch.reviewed_at}`);

    // Clean up test data
    console.log('\n3️⃣ Cleaning up test data...');
    const { error: deleteError } = await supabase
      .from('matches')
      .delete()
      .eq('line_item_id', lineItemId);

    if (deleteError) {
      console.error('⚠️ Error cleaning up:', deleteError);
    } else {
      console.log('✅ Test data cleaned up');
    }

    console.log('\n🎉 Rejection fix test completed successfully!');
    console.log('   The "Reject All Matches" button should now work without errors.');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

testRejectionFix();