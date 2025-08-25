#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testFixedMatching() {
  const testQuery = 'H S TUBING DW W/LIN 3/16"X6"BLACK';
  
  console.log('🧪 Testing fixed ML-enhanced matching...\n');
  console.log('Query:', testQuery);
  console.log('');
  
  try {
    // Test with threshold 0.15 (lower threshold to catch more matches)
    const { data: matches, error: matchError } = await supabase
      .rpc('hybrid_product_match', {
        query_text: testQuery,
        limit_count: 5,
        threshold: 0.15
      });
      
    if (matchError) {
      console.error('❌ Matching error:', matchError.message);
      return;
    }
    
    if (matches && matches.length > 0) {
      console.log(`✅ Found ${matches.length} matches with threshold 0.15:\n`);
      
      matches.forEach((match, i) => {
        console.log(`${i + 1}. ${match.sku} - ${match.name.substring(0, 65)}...`);
        console.log(`   Scores: T=${match.trigram_score?.toFixed(3)} F=${match.fuzzy_score?.toFixed(3)} A=${match.alias_score?.toFixed(3)} L=${match.learned_score?.toFixed(3)}`);
        console.log(`   Final=${match.final_score?.toFixed(3)} Via=${match.matched_via}`);
        
        // Check if this is the expected match (3/16" ID)
        if (match.name.includes('3/16') && match.name.includes('ID')) {
          console.log(`   🎯 This is the correct 3/16" match!`);
          
          if (match.final_score >= 0.3) {
            console.log(`   ✅ Score ${match.final_score?.toFixed(3)} meets 0.3 threshold - would show in app!`);
          } else {
            console.log(`   ⚠️  Score ${match.final_score?.toFixed(3)} below 0.3 threshold - need to lower threshold`);
          }
        }
        console.log('');
      });
      
      // Check if 3/16" is now the top match
      const topMatch = matches[0];
      if (topMatch.name.includes('3/16') && topMatch.name.includes('ID')) {
        console.log('🏆 Perfect! The 3/16" product is now the TOP match!');
      } else {
        console.log('🔍 The 3/16" product is in the results but not #1');
        
        // Find where 3/16" product ranks
        const correctIndex = matches.findIndex(m => m.name.includes('3/16') && m.name.includes('ID'));
        if (correctIndex >= 0) {
          console.log(`   The correct match is ranked #${correctIndex + 1}`);
          console.log(`   It has learned_score: ${matches[correctIndex].learned_score?.toFixed(3)}`);
        }
      }
      
      // Compare before and after learned scores
      console.log('\n📊 Learned Score Analysis:');
      matches.forEach((match, i) => {
        if (match.learned_score > 0) {
          console.log(`   ${match.sku}: Learned boost = ${match.learned_score?.toFixed(3)}`);
          if (match.name.includes('3/16')) {
            console.log(`     🎯 This is our target - learned boost is working!`);
          }
        }
      });
      
    } else {
      console.log('❌ No matches found even with threshold 0.15');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testFixedMatching();