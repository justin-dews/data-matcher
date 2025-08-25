#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testTextVariations() {
  console.log('🔍 Testing exact text variations from screenshot...\n');
  
  const textVariations = [
    'H S TUBING DW W/LIN 1/8"X6" BLACK',     // Working (19.4% confidence)
    'H S TUBING DW W/LIN 3/16"X6"BLACK',     // Failing (no space before BLACK)
    'H S TUBING DW W/LIN 3/4"X6"BLACK',      // Failing
    'H S TUBING DW W/LIN 1/2"X6"BLACK',      // Failing  
    'H S TUBING DW W/LIN 3/8"X6"BLACK',      // Failing
  ];
  
  console.log('Testing threshold 0.18 with exact text from screenshot:\n');
  
  try {
    for (const [index, queryText] of textVariations.entries()) {
      const isWorking = index === 0; // First one is the working 1/8" item
      
      console.log(`${index + 1}. Testing: "${queryText}"`);
      console.log(`   Expected: ${isWorking ? '✅ WORKING' : '❌ FAILING'}`);
      
      const { data: matches, error: matchError } = await supabase
        .rpc('hybrid_product_match', {
          query_text: queryText,
          limit_count: 3,
          threshold: 0.18
        });
        
      if (matchError) {
        console.log(`   ❌ Database error: ${matchError.message}`);
        continue;
      }
      
      if (matches && matches.length > 0) {
        const topMatch = matches[0];
        console.log(`   ✅ Found ${matches.length} matches - Top: ${topMatch.sku} (${topMatch.final_score?.toFixed(3)})`);
        
        if (topMatch.final_score >= 0.18) {
          console.log(`   ✅ Score ${topMatch.final_score?.toFixed(3)} meets 0.18 threshold`);
          if (!isWorking) {
            console.log(`   🚨 THIS SHOULD WORK IN APP BUT DOESN'T - Frontend issue!`);
          }
        } else {
          console.log(`   ⚠️  Score ${topMatch.final_score?.toFixed(3)} below 0.18 threshold`);
        }
      } else {
        console.log(`   ❌ No matches found`);
        if (isWorking) {
          console.log(`   🚨 THIS WORKS IN APP BUT NO DB MATCHES - Inconsistency!`);
        }
      }
      console.log('');
    }
    
    // Character-by-character analysis
    console.log('🔍 Character analysis between working and failing:');
    const working = textVariations[0];
    const failing = textVariations[1];
    
    console.log(`Working:  "${working}"`);
    console.log(`Failing:  "${failing}"`);
    console.log(`Lengths:  ${working.length} vs ${failing.length}`);
    
    console.log('\nCharacter differences:');
    const maxLength = Math.max(working.length, failing.length);
    let differenceFound = false;
    
    for (let i = 0; i < maxLength; i++) {
      const char1 = working[i] || '';
      const char2 = failing[i] || '';
      
      if (char1 !== char2) {
        console.log(`  Position ${i}: "${char1}" vs "${char2}"`);
        differenceFound = true;
      }
    }
    
    if (!differenceFound) {
      console.log('  No character differences found');
    }
    
    // Test with manual space addition
    console.log('\n🧪 Testing with manually added space:');
    const correctedText = 'H S TUBING DW W/LIN 3/16"X6" BLACK'; // Added space before BLACK
    
    const { data: correctedMatches } = await supabase
      .rpc('hybrid_product_match', {
        query_text: correctedText,
        limit_count: 3,
        threshold: 0.18
      });
      
    if (correctedMatches && correctedMatches.length > 0) {
      const topMatch = correctedMatches[0];
      console.log(`✅ With added space: ${topMatch.sku} (${topMatch.final_score?.toFixed(3)})`);
      
      if (topMatch.final_score >= 0.18) {
        console.log('✅ Adding space fixes the issue! Frontend text normalization needed.');
      }
    } else {
      console.log('❌ Even with added space, no matches found');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testTextVariations();