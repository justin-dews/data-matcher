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

async function fixTrainingDataMappings() {
  console.log('🔧 Fixing heat shrink training data mappings...\n');
  
  try {
    // Get all heat shrink products from catalog
    const { data: heatShrinkProducts, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', ORG_ID)
      .ilike('name', '%HEAT SHRINK%')
      .order('name');
      
    if (productError) {
      console.error('❌ Error fetching products:', productError);
      return;
    }
    
    console.log('📋 Available heat shrink products:');
    heatShrinkProducts.forEach((product, i) => {
      console.log(`   ${i + 1}. ${product.sku} - ${product.name}`);
    });
    console.log('');
    
    // Get all heat shrink training data
    const { data: trainingRecords, error: trainingError } = await supabase
      .from('match_training_data')
      .select('*')
      .eq('organization_id', ORG_ID)
      .ilike('line_item_text', '%HS TUBING%');
      
    if (trainingError) {
      console.error('❌ Error fetching training data:', trainingError);
      return;
    }
    
    console.log(`🔍 Found ${trainingRecords.length} heat shrink training records to fix:`);
    
    let fixedCount = 0;
    
    for (const record of trainingRecords) {
      console.log(`\n📝 Processing: "${record.line_item_text}"`);
      console.log(`   Currently mapped to: ${record.product_sku} - ${record.product_name}`);
      
      // Extract size from PDF text (1/8, 3/16, 1/2, 3/4)
      let expectedSize = null;
      if (record.line_item_text.includes('1/8')) {
        expectedSize = '1/8';
      } else if (record.line_item_text.includes('3/16')) {
        expectedSize = '3/16';
      } else if (record.line_item_text.includes('1/2')) {
        expectedSize = '1/2';
      } else if (record.line_item_text.includes('3/4')) {
        expectedSize = '3/4';
      }
      
      if (!expectedSize) {
        console.log('   ⚠️  Could not extract size from PDF text, skipping');
        continue;
      }
      
      console.log(`   🎯 Expected size: ${expectedSize}`);
      
      // Find the correct product
      const correctProduct = heatShrinkProducts.find(product => 
        product.name.includes(`${expectedSize}\" ID`) || product.name.includes(`${expectedSize}" ID`)
      );
      
      if (!correctProduct) {
        console.log(`   ❌ No product found for size ${expectedSize}`);
        continue;
      }
      
      if (correctProduct.id === record.matched_product_id) {
        console.log(`   ✅ Already correctly mapped to ${correctProduct.sku}`);
        continue;
      }
      
      console.log(`   🔧 Should map to: ${correctProduct.sku} - ${correctProduct.name}`);
      
      // Update the training record
      const { error: updateError } = await supabase
        .from('match_training_data')
        .update({
          matched_product_id: correctProduct.id,
          product_sku: correctProduct.sku,
          product_name: correctProduct.name,
          product_manufacturer: correctProduct.manufacturer,
          product_category: correctProduct.category,
          updated_at: new Date().toISOString()
        })
        .eq('id', record.id);
        
      if (updateError) {
        console.log(`   ❌ Error updating record: ${updateError.message}`);
      } else {
        console.log(`   ✅ Fixed mapping to ${correctProduct.sku}`);
        fixedCount++;
      }
    }
    
    console.log(`\n🎉 Training data mapping fix complete!`);
    console.log(`   ✅ Fixed ${fixedCount} records`);
    console.log(`   🧠 ML system should now properly boost size-specific matches`);
    
    // Test the fix
    console.log(`\n🧪 Testing the fix...`);
    const testQuery = 'H S TUBING DW W/LIN 3/16"X6"BLACK';
    
    // Find the 3/16" product
    const product316 = heatShrinkProducts.find(p => p.name.includes('3/16'));
    
    if (product316) {
      console.log(`Testing learned similarity for 3/16" product (${product316.sku}):`);
      
      const { data: testScore, error: testError } = await supabase
        .rpc('get_learned_similarity_boost', {
          p_query_text: testQuery,
          p_product_id: product316.id,
          p_org_id: ORG_ID
        });
        
      if (testError) {
        console.log(`❌ Test error: ${testError.message}`);
      } else {
        console.log(`✅ New learned similarity score: ${testScore}`);
        if (testScore > 0.4) {
          console.log(`🎯 Excellent! This should now rank higher in matching`);
        }
      }
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

fixTrainingDataMappings();