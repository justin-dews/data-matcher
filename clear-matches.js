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

async function clearMatches() {
  console.log('🧹 Clearing matches table for fresh start...\n');
  
  try {
    // Count existing matches
    const { count: matchCount, error: countError } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.error('❌ Error counting matches:', countError);
      return;
    }
    
    console.log('📊 Current matches in table:', matchCount);
    
    if (matchCount === 0) {
      console.log('✅ Matches table is already empty!');
      return;
    }
    
    // Clear all matches
    console.log('🗑️  Deleting all matches...');
    const { error: deleteError } = await supabase
      .from('matches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (using impossible condition to delete all)
    
    if (deleteError) {
      console.error('❌ Error deleting matches:', deleteError);
      return;
    }
    
    // Verify deletion
    const { count: finalCount, error: finalCountError } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true });
      
    if (finalCountError) {
      console.error('❌ Error verifying deletion:', finalCountError);
      return;
    }
    
    console.log('✅ Matches table cleared successfully!');
    console.log('📊 Remaining matches:', finalCount);
    
    console.log('\n🎯 Ready for fresh testing!');
    console.log('   • Upload a new PDF to test ML-enhanced matching');
    console.log('   • Check /dashboard/matches to see improved confidence scores');
    console.log('   • Look for learned_score > 0 in the results');
    console.log('   • Your 79 training examples will boost similar patterns');
    
  } catch (error) {
    console.error('💥 Error clearing matches:', error.message);
  }
}

clearMatches();