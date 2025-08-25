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

async function checkSpecificTrainingData() {
  console.log('🔍 Checking for specific heat shrink training data...\n');
  
  const testQuery = 'H S TUBING DW W/LIN 3/16"X6"BLACK';
  const expectedPDF = 'HS TUBING DW W/LIN 3/16"X6" BLACK';
  
  try {
    // 1. Search for exact training data from CSV
    console.log('1️⃣ Searching for exact training data from CSV...');
    console.log('Looking for PDF text:', expectedPDF);
    
    const { data: exactMatch, error: exactError } = await supabase
      .from('match_training_data')
      .select('*')
      .eq('organization_id', ORG_ID)
      .ilike('line_item_text', '%HS TUBING DW W/LIN 3/16%');
      
    if (exactError) {
      console.error('❌ Error searching exact match:', exactError);
    } else if (exactMatch && exactMatch.length > 0) {
      console.log('✅ Found exact training data:');
      exactMatch.forEach((record, i) => {
        console.log(`   ${i + 1}. PDF: "${record.line_item_text}"`);
        console.log(`      → Product: "${record.product_name}"`);
        console.log(`      → SKU: ${record.product_sku}`);
        console.log(`      → Quality: ${record.match_quality}, Confidence: ${record.match_confidence}`);
        console.log(`      → Product ID: ${record.matched_product_id}`);
        console.log(`      → Created: ${new Date(record.created_at).toLocaleString()}`);
      });
    } else {
      console.log('❌ No exact training data found');
    }
    
    console.log('');
    
    // 2. Search for any heat shrink related training data
    console.log('2️⃣ Searching for any heat shrink training data...');
    
    const { data: heatShrinkData, error: heatShrinkError } = await supabase
      .from('match_training_data')
      .select('*')
      .eq('organization_id', ORG_ID)
      .or('line_item_text.ilike.%HEAT SHRINK%,line_item_text.ilike.%HS TUBING%,product_name.ilike.%HEAT SHRINK%');
      
    if (heatShrinkError) {
      console.error('❌ Error searching heat shrink data:', heatShrinkError);
    } else if (heatShrinkData && heatShrinkData.length > 0) {
      console.log(`✅ Found ${heatShrinkData.length} heat shrink training records:`);
      heatShrinkData.forEach((record, i) => {
        console.log(`   ${i + 1}. PDF: "${record.line_item_text}"`);
        console.log(`      → Product: "${record.product_name}"`);
        console.log(`      → SKU: ${record.product_sku}`);
      });
    } else {
      console.log('❌ No heat shrink training data found at all');
    }
    
    console.log('');
    
    // 3. Test the learned similarity function directly
    console.log('3️⃣ Testing learned similarity function directly...');
    
    if (exactMatch && exactMatch.length > 0) {
      const trainingRecord = exactMatch[0];
      
      console.log(`Testing learned similarity for:`);
      console.log(`  Query: "${testQuery}"`);
      console.log(`  Product ID: ${trainingRecord.matched_product_id}`);
      
      const { data: learnedScore, error: learnedError } = await supabase
        .rpc('get_learned_similarity_boost', {
          p_query_text: testQuery,
          p_product_id: trainingRecord.matched_product_id,
          p_org_id: ORG_ID
        });
        
      if (learnedError) {
        console.log(`❌ Learned similarity error: ${learnedError.message}`);
        
        // Try with the exact training text
        console.log(`\nTrying with exact training text: "${trainingRecord.line_item_text}"`);
        const { data: exactScore, error: exactScoreError } = await supabase
          .rpc('get_learned_similarity_boost', {
            p_query_text: trainingRecord.line_item_text,
            p_product_id: trainingRecord.matched_product_id,
            p_org_id: ORG_ID
          });
          
        if (exactScoreError) {
          console.log(`❌ Even exact text failed: ${exactScoreError.message}`);
        } else {
          console.log(`✅ Exact training text score: ${exactScore}`);
        }
      } else {
        console.log(`✅ Learned similarity score: ${learnedScore}`);
        if (learnedScore === 0 || learnedScore === null) {
          console.log(`⚠️  Score is 0 - function may not be finding the pattern`);
        }
      }
    }
    
    console.log('');
    
    // 4. Check the similarity between query and training text
    console.log('4️⃣ Manual similarity check...');
    
    if (exactMatch && exactMatch.length > 0) {
      const trainingText = exactMatch[0].line_item_text;
      
      console.log(`Comparing:`);
      console.log(`  Query:    "${testQuery}"`);
      console.log(`  Training: "${trainingText}"`);
      
      // Simple character comparison
      const queryClean = testQuery.toLowerCase().replace(/[^a-z0-9]/g, '');
      const trainingClean = trainingText.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      console.log(`  Query clean:    "${queryClean}"`);
      console.log(`  Training clean: "${trainingClean}"`);
      
      // Calculate simple similarity
      const commonChars = queryClean.split('').filter(char => trainingClean.includes(char)).length;
      const similarity = commonChars / Math.max(queryClean.length, trainingClean.length);
      
      console.log(`  Simple similarity: ${(similarity * 100).toFixed(1)}%`);
      
      if (similarity > 0.7) {
        console.log(`  🎯 High similarity - learned function should boost this!`);
      } else {
        console.log(`  ⚠️  Lower similarity might explain why boost is low`);
      }
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

checkSpecificTrainingData();