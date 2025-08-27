#!/usr/bin/env node

// Direct database test - bypassing env vars by using the service key directly
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
// Using the service key from the working scripts
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMjg5NzQ1MCwiZXhwIjoyMDM4NDczNDUwfQ.sWCQZLTuOiFB-qMfYpaDZvvw4F-gTjBqEd8_oRRaGDQ';
const ORG_ID = '00000000-0000-0000-0000-000000000001';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testSpecificItem() {
  console.log('🔍 Testing specific line item: "GR. 8 HX HD CAP SCR 7/16-14X1"\n');
  
  try {
    const testText = 'GR. 8 HX HD CAP SCR 7/16-14X1';
    
    // 1. First check if this line item exists in the database
    console.log('1️⃣ Checking if line item exists...');
    const { data: lineItems, error: lineError } = await supabase
      .from('line_items')
      .select('id, raw_text, parsed_data')
      .eq('organization_id', ORG_ID)
      .ilike('raw_text', '%GR. 8 HX HD CAP SCR 7/16-14X1%');
    
    if (lineError) throw lineError;
    
    console.log(`Found ${lineItems.length} matching line items:`);
    lineItems.forEach(item => {
      console.log(`   ID: ${item.id}`);
      console.log(`   Text: "${item.raw_text}"`);
      console.log(`   Parsed: ${JSON.stringify(item.parsed_data)}`);
    });
    
    // 2. Check if it has existing matches
    if (lineItems.length > 0) {
      const lineItemId = lineItems[0].id;
      console.log(`\n2️⃣ Checking existing matches for line item ${lineItemId}...`);
      
      const { data: existingMatches, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('line_item_id', lineItemId);
      
      if (matchError) throw matchError;
      
      console.log(`Found ${existingMatches.length} existing matches:`);
      existingMatches.forEach(match => {
        console.log(`   Status: ${match.status}, Score: ${match.final_score}, Product: ${match.product_id}`);
      });
    }
    
    // 3. Test the tiered matching function
    console.log(`\n3️⃣ Testing tiered matching function...`);
    const { data: candidates, error: matchError } = await supabase.rpc('hybrid_product_match_tiered', {
      query_text: testText,
      limit_count: 5,
      threshold: 0.1 // Very low threshold to see all results
    });

    if (matchError) {
      console.error('❌ Match RPC error:', matchError);
      return;
    }

    console.log(`Found ${candidates?.length || 0} candidates:`);
    if (candidates) {
      candidates.forEach((candidate, index) => {
        console.log(`\n   ${index + 1}. ${candidate.name} (${candidate.sku})`);
        console.log(`      Score: ${candidate.final_score} via ${candidate.matched_via}`);
        console.log(`      Vector: ${candidate.vector_score}, Trigram: ${candidate.trigram_score}`);
        console.log(`      Fuzzy: ${candidate.fuzzy_score}, Alias: ${candidate.alias_score}`);
        if (candidate.matched_via === 'training_exact') {
          console.log(`      🎯 EXACT TRAINING MATCH!`);
        }
      });
    }
    
    // 4. Check training data for this exact text
    console.log(`\n4️⃣ Checking training data for exact match...`);
    const { data: trainingMatches, error: trainingError } = await supabase
      .from('match_training_data')
      .select('*')
      .eq('organization_id', ORG_ID)
      .ilike('line_item_text', '%7/16-14X1%');
    
    if (trainingError) throw trainingError;
    
    console.log(`Found ${trainingMatches.length} training data entries:`);
    trainingMatches.forEach(training => {
      console.log(`   Text: "${training.line_item_text}"`);
      console.log(`   Product: ${training.product_sku} - ${training.product_name}`);
      console.log(`   Quality: ${training.match_quality}, Confidence: ${training.match_confidence}`);
    });
    
  } catch (error) {
    console.error('💥 Test error:', error);
  }
}

testSpecificItem();