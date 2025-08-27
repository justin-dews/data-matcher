#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '00000000-0000-0000-0000-000000000001';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkTrainingData() {
  console.log('🔍 Checking match_training_data table...\n');
  
  try {
    // Check total count of training data
    console.log('1️⃣ Checking total training data count...');
    const { count, error: countError } = await supabase
      .from('match_training_data')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ORG_ID);
      
    if (countError) {
      console.error('❌ Count error:', countError);
    } else {
      console.log(`   Total training records: ${count}`);
    }
    
    // Check for the specific screw item
    console.log('\n2️⃣ Checking for specific screw training data...');
    const { data: screwTraining, error: screwError } = await supabase
      .from('match_training_data')
      .select('*')
      .eq('organization_id', ORG_ID)
      .ilike('line_item_text', '%GR. 8 HX HD CAP SCR 5/16-18X2-1/2%');
      
    if (screwError) {
      console.error('❌ Screw query error:', screwError);
    } else {
      console.log(`   Found ${screwTraining.length} training records for the screw item`);
      screwTraining.forEach(record => {
        console.log(`   - Line Item: ${record.line_item_text}`);
        console.log(`   - Product: ${record.product_sku}: ${record.product_name}`);
        console.log(`   - Quality: ${record.match_quality}`);
        console.log('');
      });
    }
    
    // Show some sample training data
    console.log('3️⃣ Sample training data records...');
    const { data: samples, error: sampleError } = await supabase
      .from('match_training_data')
      .select('line_item_text, product_sku, product_name, match_quality')
      .eq('organization_id', ORG_ID)
      .limit(5);
      
    if (sampleError) {
      console.error('❌ Sample error:', sampleError);
    } else {
      console.log(`   Showing ${samples.length} sample records:`);
      samples.forEach((sample, i) => {
        console.log(`   ${i+1}. "${sample.line_item_text}" -> ${sample.product_sku}: ${sample.product_name} (${sample.match_quality})`);
      });
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

checkTrainingData();
