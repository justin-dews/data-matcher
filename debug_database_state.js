// Debug script to check database state for hybrid_product_match issues
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co'
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key-here'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugDatabaseState() {
  console.log('🔍 Debugging database state for hybrid_product_match issues...\n')
  
  try {
    // 1. Check if products table has data
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', '00000000-0000-0000-0000-000000000001')
      .limit(5)
    
    if (productsError) {
      console.error('❌ Error querying products:', productsError)
    } else {
      console.log(`📦 Products table: ${products?.length || 0} products found`)
      if (products?.length > 0) {
        console.log('Sample products:')
        products.slice(0, 3).forEach(p => console.log(`  - ${p.sku}: ${p.name}`))
      }
    }
    
    // 2. Check line items that are trying to match
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('line_items')
      .select('id, raw_text, parsed_data')
      .eq('organization_id', '00000000-0000-0000-0000-000000000001')
      .limit(5)
    
    if (lineItemsError) {
      console.error('❌ Error querying line_items:', lineItemsError)
    } else {
      console.log(`\n📋 Line items table: ${lineItems?.length || 0} items found`)
      if (lineItems?.length > 0) {
        console.log('Sample line items:')
        lineItems.slice(0, 3).forEach(item => {
          const name = item.parsed_data?.name || item.raw_text
          console.log(`  - ${name}`)
        })
      }
    }
    
    // 3. Test the function manually with a simple query
    console.log('\n🧪 Testing hybrid_product_match function manually...')
    const testQuery = 'BOLT'
    console.log(`Testing with query: "${testQuery}"`)
    
    const { data: matchResults, error: matchError } = await supabase.rpc('hybrid_product_match', {
      query_text: testQuery,
      organization_id: '00000000-0000-0000-0000-000000000001',
      limit_count: 3,
      threshold: 0.1  // Very low threshold to see any results
    })
    
    if (matchError) {
      console.error('❌ RPC Error:', matchError)
    } else {
      console.log(`✅ Function returned ${matchResults?.length || 0} results`)
      if (matchResults?.length > 0) {
        console.log('Sample results:')
        matchResults.slice(0, 2).forEach(result => {
          console.log(`  - ${result.name} (score: ${result.final_score})`)
        })
      }
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error)
  }
}

// Run the debug
debugDatabaseState()