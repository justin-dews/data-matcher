#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '00000000-0000-0000-0000-000000000001';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function clearAllData() {
  console.log('🧹 Starting fresh: Clearing all matches, documents, and line items...\n');
  
  try {
    // 1. Clear matches table
    console.log('1️⃣ Clearing matches table...');
    const { error: matchesError, count: matchesCount } = await supabase
      .from('matches')
      .delete({ count: 'exact' })
      .eq('organization_id', ORG_ID);
      
    if (matchesError) {
      console.error('❌ Error clearing matches:', matchesError);
    } else {
      console.log(`✅ Cleared ${matchesCount} matches`);
    }
    
    // 2. Clear line_items table
    console.log('\n2️⃣ Clearing line_items table...');
    const { error: lineItemsError, count: lineItemsCount } = await supabase
      .from('line_items')
      .delete({ count: 'exact' })
      .eq('organization_id', ORG_ID);
      
    if (lineItemsError) {
      console.error('❌ Error clearing line items:', lineItemsError);
    } else {
      console.log(`✅ Cleared ${lineItemsCount} line items`);
    }
    
    // 3. Clear documents table
    console.log('\n3️⃣ Clearing documents table...');
    const { error: documentsError, count: documentsCount } = await supabase
      .from('documents')
      .delete({ count: 'exact' })
      .eq('organization_id', ORG_ID);
      
    if (documentsError) {
      console.error('❌ Error clearing documents:', documentsError);
    } else {
      console.log(`✅ Cleared ${documentsCount} documents`);
    }
    
    // 4. Clear activity_log for cleaner history
    console.log('\n4️⃣ Clearing activity log...');
    const { error: activityError, count: activityCount } = await supabase
      .from('activity_log')
      .delete({ count: 'exact' })
      .eq('organization_id', ORG_ID);
      
    if (activityError) {
      console.error('❌ Error clearing activity log:', activityError);
    } else {
      console.log(`✅ Cleared ${activityCount} activity log entries`);
    }
    
    // Note: We're keeping match_training_data intact since that's our valuable training data!
    console.log('\n📋 Note: Training data (match_training_data) kept intact for improved matching');
    
    // 5. Verify everything is cleared
    console.log('\n5️⃣ Verifying clean slate...');
    
    const verifications = await Promise.all([
      supabase.from('matches').select('*', { count: 'exact', head: true }).eq('organization_id', ORG_ID),
      supabase.from('line_items').select('*', { count: 'exact', head: true }).eq('organization_id', ORG_ID),
      supabase.from('documents').select('*', { count: 'exact', head: true }).eq('organization_id', ORG_ID),
      supabase.from('match_training_data').select('*', { count: 'exact', head: true }).eq('organization_id', ORG_ID)
    ]);
    
    const [matchesCheck, lineItemsCheck, documentsCheck, trainingCheck] = verifications;
    
    console.log('📊 Final counts:');
    console.log(`   Matches: ${matchesCheck.count || 0}`);
    console.log(`   Line Items: ${lineItemsCheck.count || 0}`);
    console.log(`   Documents: ${documentsCheck.count || 0}`);
    console.log(`   Training Data: ${trainingCheck.count || 0} (preserved)`);
    
    if ((matchesCheck.count || 0) === 0 && (lineItemsCheck.count || 0) === 0 && (documentsCheck.count || 0) === 0) {
      console.log('\n🎉 SUCCESS: Clean slate achieved! Ready for fresh testing with the new tiered matching system.');
      console.log('💡 Your valuable training data (79 records) has been preserved.');
      console.log('🚀 You can now upload new documents to test the improved matching!');
    } else {
      console.log('\n⚠️  Some data might still remain. Check the counts above.');
    }
    
  } catch (error) {
    console.error('💥 Error during cleanup:', error);
  }
}

clearAllData();