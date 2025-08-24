const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

async function testSpecificMatch() {
  console.log('=== Testing Specific Product Match ===')
  
  const lineItemText = "MTD PNT GRIND WHL, A/O, VITRIFIED, W236"
  const expectedMatch = "XUA27349    W236 1-1/2 X 1/2 X 1/4 A60R"
  
  console.log(`\n🔍 Line Item: "${lineItemText}"`)
  console.log(`🎯 Expected Match: "${expectedMatch}"`)
  
  // 1. Test normalization of both strings
  console.log('\n1. Testing normalize_product_text function:')
  
  const { data: normLineItem, error: normError1 } = await supabase.rpc('normalize_product_text', {
    input_text: lineItemText
  })
  
  const { data: normProduct, error: normError2 } = await supabase.rpc('normalize_product_text', {
    input_text: expectedMatch
  })
  
  if (normError1 || normError2) {
    console.error('Normalize errors:', normError1, normError2)
    return
  }
  
  console.log(`   Line item normalized: "${normLineItem}"`)
  console.log(`   Product normalized:   "${normProduct}"`)
  
  // 2. Check if the expected match product exists in the catalog
  console.log('\n2. Searching for expected product in catalog:')
  
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id, name, sku')
    .ilike('name', '%W236%')
    .eq('organization_id', '00000000-0000-0000-0000-000000000001')
  
  if (productError) {
    console.error('Product search error:', productError)
    return
  }
  
  console.log(`   Found ${products?.length || 0} products containing 'W236':`)
  products?.forEach(p => {
    console.log(`     - ${p.name} (${p.sku})`)
  })
  
  // 3. Test the hybrid function with this specific query
  console.log('\n3. Testing hybrid_product_match function:')
  
  const { data: matches, error: matchError } = await supabase.rpc('hybrid_product_match', {
    query_text: lineItemText,
    limit_count: 10,
    threshold: 0.01  // Very low threshold to see any matches
  })
  
  if (matchError) {
    console.error('Hybrid function error:', matchError)
  } else {
    console.log(`   Hybrid function found ${matches?.length || 0} matches:`)
    if (matches && matches.length > 0) {
      matches.forEach(match => {
        console.log(`     - ${match.name} (${match.sku})`)
        console.log(`       Trigram: ${match.trigram_score}, Alias: ${match.alias_score}, Final: ${match.final_score}`)
      })
    } else {
      console.log('     No matches found - this suggests threshold or similarity issue')
    }
  }
  
  // 4. Test with various parts of the query to see what works
  console.log('\n4. Testing different query variations:')
  
  const queryVariations = [
    'W236',
    'GRIND WHL',
    'GRINDING WHEEL',
    'W236 GRINDING WHEEL',
    'MTD GRINDING WHEEL'
  ]
  
  for (const query of queryVariations) {
    const { data: varMatches, error: varError } = await supabase.rpc('hybrid_product_match', {
      query_text: query,
      limit_count: 3,
      threshold: 0.01
    })
    
    if (!varError && varMatches && varMatches.length > 0) {
      console.log(`   ✅ "${query}" found ${varMatches.length} matches:`)
      varMatches.slice(0, 2).forEach(match => {
        console.log(`      - ${match.name} (score: ${match.final_score.toFixed(3)})`)
      })
    } else {
      console.log(`   ❌ "${query}" found 0 matches`)
    }
  }
  
  // 5. Check what the current threshold is set to in the frontend
  console.log('\n5. Recommendation:')
  console.log('   If hybrid function is returning 0 matches, the issue might be:')
  console.log('   - Threshold too high (check CONFIG.MATCHING.CONFIDENCE_THRESHOLD)')
  console.log('   - Products in catalog have different naming convention than expected')
  console.log('   - normalize_product_text function removing important matching terms')
  console.log('   - Need to create competitor_aliases for common product variations')
}

testSpecificMatch()