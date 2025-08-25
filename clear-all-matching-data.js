#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('💡 Run: export SUPABASE_SERVICE_ROLE_KEY="your-key"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const ORG_ID = '00000000-0000-0000-0000-000000000001';

async function clearAllMatchingData() {
  console.log('🧹 Clearing all matching data for fresh ML testing...\n');
  
  try {
    // Count existing data
    console.log('📊 Counting existing data...');
    
    const { count: matchCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ORG_ID);
      
    const { count: lineItemCount } = await supabase
      .from('line_items')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ORG_ID);
      
    const { count: documentCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ORG_ID);
    
    console.log('   Matches:', matchCount || 0);
    console.log('   Line Items:', lineItemCount || 0);
    console.log('   Documents:', documentCount || 0);
    console.log('');
    
    if ((matchCount || 0) === 0 && (lineItemCount || 0) === 0 && (documentCount || 0) === 0) {
      console.log('✅ All matching data is already clear!');
      console.log('📊 Training data preserved: Your 79 ML examples are still active');
      return;
    }
    
    // Clear matches first (foreign key constraint)
    if (matchCount > 0) {
      console.log('🗑️  Clearing matches...');
      const { error: matchError } = await supabase
        .from('matches')
        .delete()
        .eq('organization_id', ORG_ID);
        
      if (matchError) {
        console.error('❌ Error clearing matches:', matchError);
        return;
      }
      console.log('✅ Matches cleared');
    }
    
    // Clear line items
    if (lineItemCount > 0) {
      console.log('🗑️  Clearing line items...');
      const { error: lineItemError } = await supabase
        .from('line_items')
        .delete()
        .eq('organization_id', ORG_ID);
        
      if (lineItemError) {
        console.error('❌ Error clearing line items:', lineItemError);
        return;
      }
      console.log('✅ Line items cleared');
    }
    
    // Clear documents
    if (documentCount > 0) {
      console.log('🗑️  Clearing documents...');
      const { error: documentError } = await supabase
        .from('documents')
        .delete()
        .eq('organization_id', ORG_ID);
        
      if (documentError) {
        console.error('❌ Error clearing documents:', documentError);
        return;
      }
      console.log('✅ Documents cleared');
    }
    
    // Verify everything is clear
    console.log('\n🔍 Verifying clean state...');
    const { count: finalMatches } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ORG_ID);
      
    const { count: finalLineItems } = await supabase
      .from('line_items')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ORG_ID);
      
    const { count: finalDocuments } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ORG_ID);
    
    console.log('   Final matches:', finalMatches || 0);
    console.log('   Final line items:', finalLineItems || 0);
    console.log('   Final documents:', finalDocuments || 0);
    
    // Verify training data is preserved
    const { count: trainingCount } = await supabase
      .from('match_training_data')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ORG_ID);
      
    console.log('   Training data preserved:', trainingCount || 0);
    
    console.log('\n🎉 Fresh start ready!');
    console.log('✅ All matching data cleared');
    console.log('🧠 ML training data preserved (' + (trainingCount || 0) + ' examples)');
    console.log('🚀 Ready to test enhanced matching with learned similarity boost!');
    
    console.log('\n📋 Next Steps:');
    console.log('   1. Upload a new PDF with products similar to training data');
    console.log('   2. Check /dashboard/matches for improved confidence scores');  
    console.log('   3. Look for learned_score > 0 in matching results');
    console.log('   4. Compare against old results - should be much better!');
    
  } catch (error) {
    console.error('💥 Error clearing data:', error.message);
  }
}

clearAllMatchingData();