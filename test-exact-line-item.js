#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testExactLineItem() {
  // Test the exact text from the failing line item in the matches page
  const exactText = 'H S TUBING DW W/LIN 3/16"X6"BLACK';
  
  console.log('🧪 Testing exact line item text from /matches page...\n');
  console.log('Exact text:', `"${exactText}"`);
  console.log('Character count:', exactText.length);
  console.log('');
  
  try {
    // Test with the threshold from CONFIG (0.18)
    console.log('Testing with threshold 0.18 (current CONFIG.MATCHING.CONFIDENCE_THRESHOLD):');
    const { data: matches, error: matchError } = await supabase
      .rpc('hybrid_product_match', {
        query_text: exactText,
        limit_count: 5,
        threshold: 0.18
      });
      
    if (matchError) {
      console.error('❌ Matching error:', matchError.message);
      return;
    }
    
    if (matches && matches.length > 0) {
      console.log(`✅ Found ${matches.length} matches:\n`);
      
      matches.forEach((match, i) => {
        console.log(`${i + 1}. ${match.sku} - ${match.name.substring(0, 60)}...`);
        console.log(`   Final Score: ${match.final_score?.toFixed(3)}`);
        console.log(`   Learned: ${match.learned_score?.toFixed(3)}`);
        console.log(`   Components: T=${match.trigram_score?.toFixed(3)} F=${match.fuzzy_score?.toFixed(3)} A=${match.alias_score?.toFixed(3)}`);
        
        if (match.name.includes('3/16')) {
          console.log(`   🎯 This is the 3/16" match!`);
        }
        console.log('');
      });
    } else {
      console.log('❌ No matches found with threshold 0.18');
      
      // Try with even lower threshold
      console.log('\nTrying with threshold 0.10:');
      const { data: lowerMatches } = await supabase
        .rpc('hybrid_product_match', {
          query_text: exactText,
          limit_count: 3,
          threshold: 0.10
        });
        
      if (lowerMatches && lowerMatches.length > 0) {
        console.log(`Found ${lowerMatches.length} matches with lower threshold:`);
        lowerMatches.forEach((match, i) => {
          console.log(`  ${i + 1}. ${match.sku}: Score=${match.final_score?.toFixed(3)}`);
        });
      } else {
        console.log('Still no matches with threshold 0.10');
      }
    }
    
    // Compare with the working 1/8" text
    console.log('\n🔬 Comparing with working 1/8" text:');
    const workingText = 'H S TUBING DW W/LIN 1/8"X6" BLACK';
    
    const { data: workingMatches } = await supabase
      .rpc('hybrid_product_match', {
        query_text: workingText,
        limit_count: 3,
        threshold: 0.18
      });
      
    if (workingMatches && workingMatches.length > 0) {
      console.log(`Working 1/8" text found ${workingMatches.length} matches:`);
      workingMatches.forEach((match, i) => {
        console.log(`  ${i + 1}. ${match.sku}: Score=${match.final_score?.toFixed(3)}, Learned=${match.learned_score?.toFixed(3)}`);
      });
    } else {
      console.log('Even the working 1/8" text finds no matches - threshold issue!');
    }
    
    // Character-by-character comparison
    console.log('\n🔍 Character comparison:');
    console.log('3/16" text:', `"${exactText}"`);
    console.log('1/8" text: ', `"${workingText}"`);
    console.log('Differences:');
    for (let i = 0; i < Math.max(exactText.length, workingText.length); i++) {
      const char1 = exactText[i] || '';
      const char2 = workingText[i] || '';
      if (char1 !== char2) {
        console.log(`  Position ${i}: "${char1}" vs "${char2}"`);
      }
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testExactLineItem();