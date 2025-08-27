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

async function testMatchGeneration() {
  console.log('🧪 Testing tiered match generation for unmatched line items...\n');
  
  try {
    // Get line items that don't have matches
    const { data: unmatchedItems, error: fetchError } = await supabase
      .from('line_items')
      .select(`
        id,
        raw_text,
        parsed_data,
        match:matches(id, status)
      `)
      .eq('organization_id', ORG_ID)
      .is('matches.id', null) // No existing match
      .limit(5);

    if (fetchError) throw fetchError;

    console.log(`📋 Found ${unmatchedItems.length} line items without matches`);
    
    for (const item of unmatchedItems) {
      console.log(`\n🔍 Testing match generation for: "${item.raw_text}"`);
      
      // Test the tiered matching function
      const matchText = item.parsed_data?.name || item.raw_text;
      
      const { data: candidates, error: matchError } = await supabase.rpc('hybrid_product_match_tiered', {
        query_text: matchText,
        limit_count: 3,
        threshold: 0.2 // Lower threshold for testing
      });

      if (matchError) {
        console.error('❌ Match error:', matchError);
        continue;
      }

      if (candidates && candidates.length > 0) {
        const bestCandidate = candidates[0];
        console.log(`✅ Best match: ${bestCandidate.name} (${bestCandidate.sku})`);
        console.log(`   Score: ${bestCandidate.final_score} via ${bestCandidate.matched_via}`);
        
        if (bestCandidate.matched_via === 'training_exact') {
          console.log('🎯 PERFECT! This is an exact training match - should score 1.0');
        }
      } else {
        console.log('❌ No matches found');
      }
    }
    
    console.log('\n🎉 Test complete! You can now use the "Generate Matches" button on the /matches page.');
    
  } catch (error) {
    console.error('💥 Test error:', error);
  }
}

testMatchGeneration();