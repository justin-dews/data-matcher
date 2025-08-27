#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODA4MzIsImV4cCI6MjA3MTQ1NjgzMn0.B-qWDnZRkxToVhhpMDVgXD38fzOptalciTDHxXOkgHI';
const ORG_ID = '00000000-0000-0000-0000-000000000001';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugSpecificMatch() {
  console.log('🔍 Debugging: "GR. 8 HEX NUT 3/8-16"\n');
  
  try {
    const testText = 'GR. 8 HEX NUT 3/8-16';
    
    // 1. Check if this line item exists in the database
    console.log('1️⃣ Checking if line item exists...');
    const { data: lineItems, error: lineError } = await supabase
      .from('line_items')
      .select('id, raw_text, parsed_data')
      .eq('organization_id', ORG_ID)
      .ilike('raw_text', '%GR. 8 HEX NUT 3/8-16%');
    
    if (lineError) {
      console.error('Line item query error:', lineError);
      return;
    }
    
    console.log(`Found ${lineItems.length} matching line items:`);
    lineItems.forEach(item => {
      console.log(`   ID: ${item.id}`);
      console.log(`   Text: "${item.raw_text}"`);
      console.log(`   Parsed: ${JSON.stringify(item.parsed_data?.name || 'N/A')}`);
    });
    
    if (lineItems.length === 0) {
      console.log('❌ Line item not found in database. This could mean:');
      console.log('   - Item was not uploaded/parsed correctly');
      console.log('   - Text doesn\'t match exactly');
      return;
    }
    
    // 2. Check if it has existing matches
    const lineItemId = lineItems[0].id;
    console.log(`\n2️⃣ Checking existing matches for line item ${lineItemId}...`);
    
    const { data: existingMatches, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('line_item_id', lineItemId);
    
    if (matchError) {
      console.error('Match query error:', matchError);
      return;
    }
    
    console.log(`Found ${existingMatches.length} existing matches:`);
    if (existingMatches.length > 0) {
      existingMatches.forEach(match => {
        console.log(`   Status: ${match.status}, Score: ${match.final_score}`);
        console.log(`   Product ID: ${match.product_id}`);
        console.log(`   Reasoning: ${match.reasoning}`);
      });
    } else {
      console.log('   ❌ No existing matches found - this explains why it\'s not showing on /matches page');
    }
    
    // 3. Test the tiered matching function directly
    console.log(`\n3️⃣ Testing tiered matching function for "${testText}"...`);
    const { data: candidates, error: rpcError } = await supabase.rpc('hybrid_product_match_tiered', {
      query_text: testText,
      limit_count: 5,
      threshold: 0.1
    });

    if (rpcError) {
      console.error('❌ RPC Error:', rpcError);
      return;
    }

    console.log(`Found ${candidates?.length || 0} candidates:`);
    if (candidates && candidates.length > 0) {
      candidates.forEach((candidate, index) => {
        console.log(`\n   ${index + 1}. ${candidate.name} (${candidate.sku})`);
        console.log(`      Score: ${candidate.final_score} via ${candidate.matched_via}`);
        console.log(`      Vector: ${candidate.vector_score}, Trigram: ${candidate.trigram_score}`);
        if (candidate.matched_via === 'training_exact') {
          console.log(`      🎯 EXACT TRAINING MATCH - should have score 1.0!`);
        }
      });
    } else {
      console.log('   ❌ No candidates found - this suggests an issue with the matching function');
    }
    
    // 4. Check training data
    console.log(`\n4️⃣ Checking training data for matches...`);
    const { data: trainingMatches, error: trainingError } = await supabase
      .from('match_training_data')
      .select('*')
      .eq('organization_id', ORG_ID)
      .ilike('line_item_text', '%HEX NUT 3/8-16%');
    
    if (trainingError) {
      console.error('Training data query error:', trainingError);
      return;
    }
    
    console.log(`Found ${trainingMatches.length} training data entries with "HEX NUT 3/8-16":`);
    trainingMatches.forEach(training => {
      console.log(`   Text: "${training.line_item_text}"`);
      console.log(`   Product: ${training.product_sku} - ${training.product_name}`);
      console.log(`   Quality: ${training.match_quality}, Confidence: ${training.match_confidence}`);
    });
    
  } catch (error) {
    console.error('💥 Debug error:', error);
  }
}

debugSpecificMatch();