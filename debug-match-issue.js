#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '00000000-0000-0000-0000-000000000001';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('💡 Run: export SUPABASE_SERVICE_ROLE_KEY="your-key"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function debugMatchIssue() {
  const testQuery = 'H S TUBING DW W/LIN 3/16"X6"BLACK';
  const expectedProduct = 'HEAT SHRINK MULTI-WALL 12" STK 3/16"ID, BLACK, 3:1 S/R';
  
  console.log('🔍 Debugging matching issue...\n');
  console.log('Query text:', testQuery);
  console.log('Expected match:', expectedProduct);
  console.log('');
  
  try {
    // 1. Check if the product exists in catalog
    console.log('1️⃣ Searching for expected product in catalog...');
    const { data: catalogSearch, error: catalogError } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', ORG_ID)
      .ilike('name', '%HEAT SHRINK%')
      .limit(5);
      
    if (catalogError) {
      console.error('❌ Catalog search error:', catalogError);
      return;
    }
    
    if (catalogSearch && catalogSearch.length > 0) {
      console.log('✅ Found heat shrink products in catalog:');
      catalogSearch.forEach((product, i) => {
        console.log(`   ${i + 1}. ${product.sku} - ${product.name}`);
        if (product.name.includes('3/16') && product.name.includes('BLACK')) {
          console.log('      ⭐ This looks like the expected match!');
        }
      });
    } else {
      console.log('❌ No heat shrink products found in catalog');
    }
    
    console.log('');
    
    // 2. Check if there's training data for this pattern
    console.log('2️⃣ Checking training data for similar patterns...');
    const { data: trainingData, error: trainingError } = await supabase
      .from('match_training_data')
      .select('*')
      .eq('organization_id', ORG_ID)
      .or('line_item_text.ilike.%H S TUBING%,line_item_text.ilike.%HEAT SHRINK%')
      .limit(5);
      
    if (trainingError) {
      console.error('❌ Training data search error:', trainingError);
    } else if (trainingData && trainingData.length > 0) {
      console.log('✅ Found training data for similar patterns:');
      trainingData.forEach((record, i) => {
        console.log(`   ${i + 1}. PDF: "${record.line_item_text}"`);
        console.log(`      → Catalog: "${record.product_name}"`);
        console.log(`      Quality: ${record.match_quality}, Confidence: ${record.match_confidence}`);
      });
    } else {
      console.log('⚠️  No training data found for heat shrink patterns');
    }
    
    console.log('');
    
    // 3. Test the hybrid matching function with different thresholds
    console.log('3️⃣ Testing hybrid matching function...');
    
    const thresholds = [0.1, 0.2, 0.3, 0.4, 0.5];
    
    for (const threshold of thresholds) {
      console.log(`\nTesting threshold ${threshold}:`);
      
      const { data: matches, error: matchError } = await supabase
        .rpc('hybrid_product_match', {
          query_text: testQuery,
          limit_count: 3,
          threshold: threshold
        });
        
      if (matchError) {
        console.log(`  ❌ Error: ${matchError.message}`);
        continue;
      }
      
      if (matches && matches.length > 0) {
        console.log(`  ✅ Found ${matches.length} matches:`);
        matches.forEach((match, i) => {
          console.log(`     ${i + 1}. ${match.sku} - ${match.name.substring(0, 60)}...`);
          console.log(`        Scores: Trigram=${match.trigram_score?.toFixed(3)} Fuzzy=${match.fuzzy_score?.toFixed(3)} Alias=${match.alias_score?.toFixed(3)} Learned=${match.learned_score?.toFixed(3)}`);
          console.log(`        Final=${match.final_score?.toFixed(3)} Via=${match.matched_via}`);
          
          // Check if this is the expected match
          if (match.name.includes('HEAT SHRINK') && match.name.includes('3/16') && match.name.includes('BLACK')) {
            console.log(`        🎯 This is the expected match!`);
          }
        });
      } else {
        console.log(`  ❌ No matches found`);
      }
    }
    
    // 4. Test individual similarity components
    console.log('\n4️⃣ Testing individual similarity components...');
    
    if (catalogSearch && catalogSearch.length > 0) {
      const targetProduct = catalogSearch.find(p => 
        p.name.includes('3/16') && p.name.includes('BLACK')
      );
      
      if (targetProduct) {
        console.log(`\nTesting similarity with: ${targetProduct.name}`);
        
        // Test normalize_product_text function
        const { data: normalizedQuery, error: normError1 } = await supabase
          .rpc('normalize_product_text', { input_text: testQuery });
          
        const { data: normalizedProduct, error: normError2 } = await supabase
          .rpc('normalize_product_text', { input_text: targetProduct.name });
          
        if (!normError1 && !normError2) {
          console.log(`Query normalized: "${normalizedQuery}"`);
          console.log(`Product normalized: "${normalizedProduct}"`);
        }
        
        // Test learned similarity
        const { data: learnedScore, error: learnedError } = await supabase
          .rpc('get_learned_similarity_boost', {
            p_query_text: testQuery,
            p_product_id: targetProduct.id,
            p_org_id: ORG_ID
          });
          
        if (!learnedError) {
          console.log(`Learned similarity score: ${learnedScore}`);
        } else {
          console.log(`Learned similarity error: ${learnedError.message}`);
        }
      }
    }
    
    console.log('\n🎯 Summary:');
    console.log('If no matches were found at threshold 0.1, the issue might be:');
    console.log('1. Text normalization removing important characters');
    console.log('2. Similarity algorithms not recognizing abbreviations');
    console.log('3. Training data not being applied correctly');
    console.log('4. Database function errors');
    
  } catch (error) {
    console.error('💥 Debug error:', error.message);
  }
}

debugMatchIssue();