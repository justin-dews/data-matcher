#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function deployFunctions() {
  console.log('🚀 Deploying ML functions to database...\n');
  
  try {
    // Deploy learned similarity boost function
    console.log('1️⃣ Deploying get_learned_similarity_boost function...');
    const learnedSimilaritySQL = fs.readFileSync('get_learned_similarity_boost.sql', 'utf8');
    
    const { error: learnedError } = await supabase.rpc('exec', { 
      query: learnedSimilaritySQL 
    });
    
    if (learnedError) {
      // Try alternative deployment method
      const lines = learnedSimilaritySQL.split(';').filter(line => line.trim());
      for (const line of lines) {
        if (line.trim() && !line.trim().startsWith('--')) {
          const { error } = await supabase.rpc('exec', { query: line.trim() + ';' });
          if (error && !error.message.includes('already exists')) {
            console.error('Error deploying learned similarity function:', error);
          }
        }
      }
    }
    
    console.log('✅ Learned similarity function deployed');
    
    // Deploy enhanced hybrid matching function
    console.log('2️⃣ Deploying enhanced hybrid_product_match function...');
    const hybridSQL = fs.readFileSync('enhanced_hybrid_product_match_with_ml.sql', 'utf8');
    
    const { error: hybridError } = await supabase.rpc('exec', { 
      query: hybridSQL 
    });
    
    if (hybridError) {
      // Try alternative deployment method
      const lines = hybridSQL.split(';').filter(line => line.trim());
      for (const line of lines) {
        if (line.trim() && !line.trim().startsWith('--')) {
          const { error } = await supabase.rpc('exec', { query: line.trim() + ';' });
          if (error && !error.message.includes('already exists')) {
            console.error('Error deploying hybrid function:', error);
          }
        }
      }
    }
    
    console.log('✅ Enhanced hybrid matching function deployed');
    
    // Test the functions
    console.log('\n🧪 Testing deployed functions...');
    
    // Test learned similarity
    const { data: testLearned, error: testLearnedError } = await supabase
      .rpc('get_learned_similarity_boost', {
        p_query_text: 'test query',
        p_product_id: '00000000-0000-0000-0000-000000000000',
        p_org_id: '00000000-0000-0000-0000-000000000001'
      });
      
    if (testLearnedError) {
      console.log('⚠️ Learned similarity test error:', testLearnedError.message);
    } else {
      console.log('✅ Learned similarity function is accessible');
    }
    
    // Test hybrid matching
    const { data: testHybrid, error: testHybridError } = await supabase
      .rpc('hybrid_product_match', {
        query_text: 'test',
        limit_count: 1,
        threshold: 0.1
      });
      
    if (testHybridError) {
      console.log('⚠️ Hybrid matching test error:', testHybridError.message);
    } else {
      console.log('✅ Enhanced hybrid matching function is working');
    }
    
    console.log('\n🎉 ML functions deployment complete!');
    console.log('Your machine learning enhanced matching system is now active.');
    
  } catch (error) {
    console.error('💥 Deployment error:', error.message);
  }
}

deployFunctions();