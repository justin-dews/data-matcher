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

async function debugLineItemProcessing() {
  console.log('🔍 Debugging line item processing for 3/16" heat shrink...\n');
  
  try {
    // 1. Find the specific line item
    console.log('1️⃣ Finding the 3/16" heat shrink line item...');
    const { data: lineItems, error: lineItemError } = await supabase
      .from('line_items')
      .select('*')
      .eq('organization_id', ORG_ID)
      .ilike('raw_text', '%3/16%')
      .ilike('raw_text', '%TUBING%');
      
    if (lineItemError) {
      console.error('❌ Error fetching line items:', lineItemError);
      return;
    }
    
    if (!lineItems || lineItems.length === 0) {
      console.log('❌ No line items found matching the pattern');
      return;
    }
    
    console.log(`✅ Found ${lineItems.length} matching line item(s):`);
    lineItems.forEach((item, i) => {
      console.log(`   ${i + 1}. ID: ${item.id}`);
      console.log(`      Raw text: "${item.raw_text}"`);
      console.log(`      Parsed data:`, item.parsed_data);
    });
    
    // Focus on the first matching item
    const targetLineItem = lineItems[0];
    console.log(`\n🎯 Analyzing line item: ${targetLineItem.id}`);
    
    // 2. Check what text will be used for matching
    const matchText = targetLineItem.parsed_data?.name || targetLineItem.raw_text;
    console.log(`\n2️⃣ Text that will be used for matching: "${matchText}"`);
    
    // 3. Check if there's already a match record
    console.log('\n3️⃣ Checking for existing match record...');
    const { data: existingMatch, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('line_item_id', targetLineItem.id);
      
    if (matchError) {
      console.error('❌ Error checking existing match:', matchError);
    } else if (existingMatch && existingMatch.length > 0) {
      console.log('✅ Found existing match record:');
      existingMatch.forEach((match, i) => {
        console.log(`   ${i + 1}. Status: ${match.status}`);
        console.log(`      Product ID: ${match.product_id}`);
        console.log(`      Final score: ${match.final_score}`);
        console.log(`      Confidence: ${match.confidence_score}`);
      });
    } else {
      console.log('⚠️  No existing match record found');
    }
    
    // 4. Simulate the exact same matching process as the app
    console.log('\n4️⃣ Testing hybrid matching with current CONFIG threshold...');
    const configThreshold = 0.18; // The value we set
    
    const { data: matches, error: hybridError } = await supabase
      .rpc('hybrid_product_match', {
        query_text: matchText,
        limit_count: 5,
        threshold: configThreshold
      });
      
    if (hybridError) {
      console.error('❌ Hybrid matching error:', hybridError.message);
    } else if (matches && matches.length > 0) {
      console.log(`✅ Found ${matches.length} matches with threshold ${configThreshold}:`);
      matches.forEach((match, i) => {
        console.log(`   ${i + 1}. ${match.sku} - ${match.name.substring(0, 60)}...`);
        console.log(`      Final: ${match.final_score?.toFixed(3)}, Learned: ${match.learned_score?.toFixed(3)}`);
      });
      
      console.log('\n🤔 The matches ARE being found by the hybrid function...');
      console.log('   This suggests the issue is in the frontend React code, not the database.');
    } else {
      console.log(`❌ No matches found with threshold ${configThreshold}`);
      console.log('   This would explain why the matches page shows "No matches found"');
    }
    
    // 5. Test with various thresholds to understand the cutoff
    console.log('\n5️⃣ Testing various thresholds to find the actual cutoff...');
    const testThresholds = [0.05, 0.10, 0.15, 0.18, 0.20, 0.25, 0.30];
    
    for (const threshold of testThresholds) {
      const { data: testMatches } = await supabase
        .rpc('hybrid_product_match', {
          query_text: matchText,
          limit_count: 1,
          threshold: threshold
        });
        
      const matchCount = testMatches ? testMatches.length : 0;
      const topScore = testMatches && testMatches.length > 0 ? testMatches[0].final_score : 0;
      
      console.log(`   Threshold ${threshold}: ${matchCount} matches (top score: ${topScore?.toFixed(3)})`);
    }
    
    // 6. Check browser console logs
    console.log('\n6️⃣ Next steps for debugging:');
    console.log('   1. Open browser dev tools (F12) on the /matches page');
    console.log('   2. Look for console logs starting with "🔍 Generating matches for:"');
    console.log(`   3. You should see: 🔍 Generating matches for: "${matchText}"`);
    console.log('   4. Check if there are any JavaScript errors after that log');
    console.log('   5. Check the Network tab for the hybrid_product_match RPC call');
    
    console.log('\n💡 If the browser shows different text than expected:');
    console.log(`   Expected: "${matchText}"`);
    console.log('   Actual: [check browser console]');
    console.log('   This could indicate a text processing issue in the React code');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

debugLineItemProcessing();