const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

async function debugProducts() {
  console.log('=== DEBUG: Testing product visibility and RLS ===')
  
  // 1. Check if we can see any products with service role (bypasses RLS)
  console.log('\n1. Testing raw products query with service role:')
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, sku, organization_id')
    .limit(5)
  
  if (productsError) {
    console.error('Error querying products:', productsError)
  } else {
    console.log(`Found ${products?.length || 0} products`)
    products?.forEach(p => {
      console.log(`  - ${p.name} (${p.sku}) [org: ${p.organization_id}]`)
    })
  }

  // 2. Test similarity function directly on raw products
  console.log('\n2. Testing similarity function directly on products:')
  const { data: simResults, error: simError } = await supabase
    .rpc('exec_raw_sql', {
      sql: `
        SELECT name, sku, 
               similarity(normalize_product_text(name), normalize_product_text('PLUG BRASS')) as sim_score
        FROM products 
        WHERE similarity(normalize_product_text(name), normalize_product_text('PLUG BRASS')) > 0.1
        ORDER BY sim_score DESC 
        LIMIT 5;
      `
    })
  
  if (simError) {
    console.error('Error testing similarity:', simError)
  } else {
    console.log('Similarity results:', simResults)
  }

  // 3. Test the hybrid function with detailed logging
  console.log('\n3. Testing hybrid_product_match function with debug info:')
  const { data: hybridResults, error: hybridError } = await supabase.rpc('hybrid_product_match', {
    query_text: 'PLUG BRASS',
    limit_count: 5,
    threshold: 0.01  // Very low threshold to see if anything matches
  })
  
  if (hybridError) {
    console.error('Error calling hybrid function:', hybridError)
  } else {
    console.log(`Hybrid function returned ${hybridResults?.length || 0} matches`)
    if (hybridResults && hybridResults.length > 0) {
      hybridResults.forEach(match => {
        console.log(`  - ${match.name} (${match.sku}) - Final: ${match.final_score}`)
      })
    }
  }
}

debugProducts()