const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

async function diagnoseCatalogContent() {
  console.log('=== DIAGNOSTIC: Catalog Content vs Line Items ===')
  
  const orgId = '00000000-0000-0000-0000-000000000001'
  
  // 1. Get ALL products in catalog to see what we're working with
  console.log('\n1. 📦 COMPLETE PRODUCT CATALOG:')
  const { data: allProducts, error: productsError } = await supabase
    .from('products')
    .select('name, sku, manufacturer')
    .eq('organization_id', orgId)
    .order('name')
  
  if (productsError) {
    console.error('❌ Cannot access products:', productsError)
    return
  }
  
  console.log(`   Total products in catalog: ${allProducts.length}`)
  allProducts.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.name} (${p.sku})${p.manufacturer ? ` - ${p.manufacturer}` : ''}`)
  })
  
  // 2. Get current line items to see what we're trying to match
  console.log('\n2. 📋 CURRENT LINE ITEMS TO MATCH:')
  const { data: lineItems, error: lineItemsError } = await supabase
    .from('line_items')
    .select('raw_text, parsed_data')
    .eq('organization_id', orgId)
    .order('created_at')
    .limit(15)
  
  if (lineItemsError) {
    console.error('❌ Cannot access line items:', lineItemsError)
    return
  }
  
  console.log(`   Total line items: ${lineItems.length}`)
  lineItems.forEach((item, i) => {
    const displayText = item.parsed_data?.name || item.raw_text
    console.log(`   ${i + 1}. "${displayText}"`)
  })
  
  // 3. Manual similarity analysis
  console.log('\n3. 🔍 MANUAL SIMILARITY ANALYSIS:')
  console.log('   Looking for potential matches...')
  
  // Check for any obvious word overlaps
  const productWords = new Set()
  allProducts.forEach(p => {
    const words = p.name.toLowerCase().split(/[^a-zA-Z0-9]+/).filter(w => w.length > 2)
    words.forEach(word => productWords.add(word))
  })
  
  console.log(`   Unique words in product catalog (${productWords.size} total):`)
  const sortedWords = Array.from(productWords).sort()
  console.log(`   ${sortedWords.join(', ')}`)
  
  // Check line item words against catalog
  console.log('\n   Analyzing line items for word matches:')
  lineItems.slice(0, 5).forEach((item, i) => {
    const displayText = item.parsed_data?.name || item.raw_text
    const itemWords = displayText.toLowerCase().split(/[^a-zA-Z0-9]+/).filter(w => w.length > 2)
    const matches = itemWords.filter(word => productWords.has(word))
    console.log(`   ${i + 1}. "${displayText}"`)
    console.log(`      Words: ${itemWords.join(', ')}`)
    console.log(`      Matches: ${matches.length > 0 ? matches.join(', ') : 'NONE'}`)
  })
  
  // 4. Test a simple similarity calculation
  console.log('\n4. 🧪 TESTING BASIC SIMILARITY:')
  
  // Test normalize function on a few examples
  const testItems = lineItems.slice(0, 3)
  for (const item of testItems) {
    const displayText = item.parsed_data?.name || item.raw_text
    console.log(`\n   Testing: "${displayText}"`)
    
    const { data: normalized, error: normError } = await supabase.rpc('normalize_product_text', {
      input_text: displayText
    })
    
    if (!normError) {
      console.log(`   Normalized: "${normalized}"`)
      
      // Check if any product names contain parts of this normalized text
      const possibleMatches = allProducts.filter(p => {
        const productNorm = p.name.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
        const itemNorm = normalized
        
        // Check for common words
        const productWords = productNorm.split(' ')
        const itemWords = itemNorm.split(' ')
        const commonWords = productWords.filter(pw => itemWords.some(iw => iw === pw || pw.includes(iw) || iw.includes(pw)))
        
        return commonWords.length > 0
      })
      
      console.log(`   Potential matches (${possibleMatches.length}):`)
      possibleMatches.slice(0, 3).forEach(match => {
        console.log(`     - ${match.name} (${match.sku})`)
      })
    }
  }
  
  console.log('\n💡 DIAGNOSIS COMPLETE')
  console.log('   If no potential matches were found above, the issue is:')
  console.log('   - Your line items contain completely different product types than your catalog')
  console.log('   - The normalize function might be over-filtering')
  console.log('   - Similarity thresholds need to be even lower')
  console.log('')
  console.log('   If potential matches WERE found, the issue is in the hybrid function logic')
}

diagnoseCatalogContent()