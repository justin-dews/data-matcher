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

async function checkTrainingData() {
  console.log('🔍 Checking match_training_data table...\n');
  
  try {
    // Count total records
    const { count, error: countError } = await supabase
      .from('match_training_data')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.error('❌ Error counting records:', countError);
      return;
    }
    
    console.log('📊 Total training records:', count);
    
    // Get sample of recent records
    const { data: samples, error: sampleError } = await supabase
      .from('match_training_data')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (sampleError) {
      console.error('❌ Error fetching samples:', sampleError);
      return;
    }
    
    console.log('\n📋 Sample training records:');
    samples?.forEach((record, i) => {
      console.log(`Record ${i + 1}:`);
      console.log('  PDF Text:', record.line_item_text.substring(0, 60) + '...');
      console.log('  Catalog Product:', record.product_name.substring(0, 60) + '...');
      console.log('  SKU:', record.product_sku);
      console.log('  Quality:', record.match_quality);
      console.log('  Confidence:', record.match_confidence);
      console.log('  Times Referenced:', record.times_referenced);
      console.log('  Training Weight:', record.training_weight);
      console.log('  Created:', new Date(record.created_at).toLocaleString());
      console.log('');
    });
    
    // Check match quality distribution
    const { data: qualityStats, error: qualityError } = await supabase
      .from('match_training_data')
      .select('match_quality')
      .order('match_quality');
      
    if (!qualityError && qualityStats) {
      const qualityCounts = qualityStats.reduce((acc, record) => {
        acc[record.match_quality] = (acc[record.match_quality] || 0) + 1;
        return acc;
      }, {});
      
      console.log('📈 Match Quality Distribution:');
      Object.entries(qualityCounts).forEach(([quality, count]) => {
        console.log('  ', quality + ':', count);
      });
      console.log('');
    }
    
    // Check if learned similarity function exists
    console.log('🧠 Testing learned similarity boost function...');
    
    if (samples && samples.length > 0) {
      const testText = samples[0].line_item_text;
      const testProductId = samples[0].matched_product_id;
      
      console.log(`Testing with: "${testText.substring(0, 40)}..." → Product ID: ${testProductId}`);
      
      const { data: testResult, error: testError } = await supabase
        .rpc('get_learned_similarity_boost', {
          input_text: testText,
          product_id: testProductId
        });
        
      if (testError) {
        console.log('⚠️  Function test error:', testError.message);
        console.log('   This might mean the function needs to be deployed to your database.');
      } else {
        console.log('✅ Learned similarity boost result:', testResult);
        console.log('   This means the ML function is working correctly!');
      }
    }
    
    // Test hybrid matching function
    console.log('\n🔀 Testing hybrid matching with learned similarity...');
    
    if (samples && samples.length > 0) {
      const testText = samples[0].line_item_text;
      console.log(`Testing hybrid match for: "${testText.substring(0, 50)}..."`);
      
      const { data: matchResult, error: matchError } = await supabase
        .rpc('hybrid_product_match', {
          query_text: testText,
          limit_count: 3,
          threshold: 0.1
        });
        
      if (matchError) {
        console.log('⚠️  Hybrid match test error:', matchError.message);
      } else if (matchResult && matchResult.length > 0) {
        console.log('✅ Top matches found:');
        matchResult.forEach((match, i) => {
          console.log(`  ${i + 1}. ${match.sku} - ${match.name.substring(0, 40)}...`);
          console.log(`     Scores: Vector=${match.vector_score?.toFixed(3)} Trigram=${match.trigram_score?.toFixed(3)} Fuzzy=${match.fuzzy_score?.toFixed(3)} Alias=${match.alias_score?.toFixed(3)} Learned=${match.learned_score?.toFixed(3)}`);
          console.log(`     Final=${match.final_score?.toFixed(3)} Via=${match.matched_via}`);
        });
      } else {
        console.log('⚠️  No matches found (might need lower threshold)');
      }
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
  }
}

checkTrainingData();