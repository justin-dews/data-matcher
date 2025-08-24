const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

async function testRawSimilarity() {
  console.log('=== Testing Raw Similarity Function ===')
  
  // Test the exact W236 product that should match
  const productId = await getW236ProductId()
  if (!productId) {
    console.error('Could not find W236 product')
    return
  }
  
  console.log('\n1. Testing raw similarity calculations:')
  
  const testQueries = [
    'W236',
    'w236',
    'MTD PNT GRIND WHL, A/O, VITRIFIED, W236',
    'W236 GRINDING WHEEL'
  ]
  
  for (const query of testQueries) {
    console.log(`\n🔍 Testing query: "${query}"`)
    
    // Test similarity directly via SQL
    const { data: simData, error: simError } = await supabase
      .rpc('exec_raw_query', {
        query: `
          SELECT 
            p.name,
            p.sku,
            normalize_product_text(p.name) as normalized_product,
            normalize_product_text('${query}') as normalized_query,
            similarity(normalize_product_text(p.name), normalize_product_text('${query}')) as name_similarity,
            similarity(p.sku, '${query}') as sku_similarity,
            CASE 
              WHEN p.manufacturer IS NOT NULL THEN similarity(p.manufacturer, '${query}')
              ELSE 0 
            END as manufacturer_similarity
          FROM products p
          WHERE p.id = '${productId}'
        `
      })
    
    if (simError && simError.code === 'PGRST202') {
      // Try alternative approach - direct product query with manual calculation
      console.log('   exec_raw_query not available, testing via product query...')
      
      const { data: product, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()
      
      if (!prodError && product) {
        console.log(`     Product: "${product.name}" (${product.sku})`)
        console.log(`     Query contains "${product.sku}"? ${query.includes(product.sku)}`)
        console.log(`     Product name contains part of query? ${checkContains(product.name, query)}`)
      }
    } else if (!simError && simData) {
      console.log('     Raw similarity results:', simData)
    } else {
      console.error('     Similarity test error:', simError)
    }
  }
  
  // 2. Test the hybrid function with debug output
  console.log('\n2. Testing hybrid function with very low threshold:')
  const { data: hybridData, error: hybridError } = await supabase
    .rpc('hybrid_product_match', {
      query_text: 'W236',
      limit_count: 10,
      threshold: 0.001  // Extremely low threshold
    })
  
  if (hybridError) {
    console.error('Hybrid error:', hybridError)
  } else {
    console.log(`   Found ${hybridData?.length || 0} matches with threshold 0.001`)
    hybridData?.forEach(match => {
      console.log(`     - ${match.name} (${match.sku}) - Final: ${match.final_score}`)
    })
  }
  
  // 3. Check the CONFIG threshold used in frontend
  console.log('\n3. Checking frontend configuration...')
  console.log('   The frontend likely uses CONFIG.MATCHING.CONFIDENCE_THRESHOLD')
  console.log('   If this is set too high (like 0.4 or 0.85), it would block all matches')
  console.log('   Recommendation: Check src/lib/utils.ts for CONFIG values')
}

async function getW236ProductId() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id')
    .eq('sku', 'XUA27349')
    .eq('organization_id', '00000000-0000-0000-0000-000000000001')
    .single()
  
  return products?.id
}

function checkContains(productName, query) {
  const productWords = productName.toLowerCase().split(/\s+/)
  const queryWords = query.toLowerCase().split(/\s+/)
  
  const matches = queryWords.filter(qWord => 
    productWords.some(pWord => pWord.includes(qWord) || qWord.includes(pWord))
  )
  
  return matches.length > 0 ? `Yes: ${matches.join(', ')}` : 'No'
}

testRawSimilarity()