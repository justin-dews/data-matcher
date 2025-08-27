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

async function debugTrainingData() {
  console.log('🔍 Debugging training data for screw item...\n');
  
  try {
    const lineItemText = 'GR. 8 HX HD CAP SCR 5/16-18X2-1/2';
    const expectedProduct = 'HEX CAP SCREW BOLT UNC ZINC 5/16"-18 X 2-1/2", GR 8';
    
    // 1. Check if competitor aliases exist
    console.log('1️⃣ Checking competitor aliases...');
    const { data: aliases, error: aliasError } = await supabase
      .from('competitor_aliases')
      .select('*')
      .eq('organization_id', ORG_ID)
      .or(`competitor_name.ilike.%${lineItemText}%,competitor_sku.ilike.%${lineItemText}%`);
      
    if (aliasError) {
      console.error('❌ Alias error:', aliasError);
    } else {
      console.log(`   Found ${aliases.length} aliases matching "${lineItemText}"`);
      aliases.forEach(alias => {
        console.log(`   - ${alias.competitor_name} -> ${alias.product_id} (confidence: ${alias.confidence_score})`);
      });
    }
    
    // 2. Check if the expected product exists
    console.log('\n2️⃣ Checking for expected product...');
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', ORG_ID)
      .ilike('name', `%${expectedProduct.slice(0, 20)}%`);
      
    if (prodError) {
      console.error('❌ Product error:', prodError);
    } else {
      console.log(`   Found ${products.length} products matching "${expectedProduct.slice(0, 20)}..."`);
      products.forEach(prod => {
        console.log(`   - ${prod.sku}: ${prod.name}`);
      });
    }
    
    // 3. Test the hybrid matching function directly
    console.log('\n3️⃣ Testing hybrid matching function...');
    const { data: matches, error: matchError } = await supabase
      .rpc('hybrid_product_match', {
        query_text: lineItemText,
        query_embedding: new Array(1536).fill(0.001), // dummy embedding
        org_id: ORG_ID,
        limit_count: 5
      });
      
    if (matchError) {
      console.error('❌ Match error:', matchError);
    } else {
      console.log(`   Hybrid function returned ${matches.length} matches:`);
      matches.forEach((match, i) => {
        console.log(`   ${i+1}. ${match.sku}: ${match.name}`);
        console.log(`      Vector: ${match.vector_score}, Trigram: ${match.trigram_score}, Alias: ${match.alias_score}`);
        console.log(`      Final: ${match.final_score} (via ${match.matched_via})`);
      });
    }
    
    // 4. Check the total count of competitor aliases
    console.log('\n4️⃣ Checking total competitor aliases in system...');
    const { count, error: countError } = await supabase
      .from('competitor_aliases')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ORG_ID);
      
    if (countError) {
      console.error('❌ Count error:', countError);
    } else {
      console.log(`   Total competitor aliases in system: ${count}`);
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

debugTrainingData();