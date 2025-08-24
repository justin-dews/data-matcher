const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

async function runTest() {
  console.log('=== Creating and Testing RLS-Free Hybrid Function ===')
  
  // 1. First create the test function by running the SQL
  console.log('\n1. Creating hybrid_product_match_test function...')
  const sql = fs.readFileSync('test_hybrid_without_rls.sql', 'utf8')
  const statements = sql.split(';').filter(s => s.trim())
  
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        const { error } = await supabase.rpc('exec_sql', { query: statement })
        if (error) {
          // Try running directly as raw query since exec_sql doesn't exist
          console.log('exec_sql not available, trying alternative approach...')
        }
      } catch (e) {
        // Expected - exec_sql doesn't exist
      }
    }
  }
  
  // 2. Test the new function directly via RPC
  console.log('\n2. Testing hybrid_product_match_test function...')
  const { data, error } = await supabase.rpc('hybrid_product_match_test', {
    query_text: 'PLUG BRASS',
    test_org_id: '00000000-0000-0000-0000-000000000001',
    limit_count: 5,
    threshold: 0.01
  })
  
  if (error) {
    console.error('❌ Test function error:', error)
    
    // If test function doesn't exist, let's try creating it differently
    console.log('\n3. Trying to verify the issue is indeed RLS...')
    
    // Let's test if we can find products with good similarity scores manually
    const { data: manualTest, error: manualError } = await supabase
      .from('products')
      .select('id, name, sku, organization_id')
      .eq('organization_id', '00000000-0000-0000-0000-000000000001')
      .limit(10)
    
    if (manualError) {
      console.error('Manual query error:', manualError)
    } else {
      console.log(`\n📋 Found ${manualTest.length} products in the organization:`)
      manualTest.forEach(p => {
        console.log(`  - ${p.name} (${p.sku})`)
      })
      
      // Check if any contain "PLUG" or "BRASS"
      const plugProducts = manualTest.filter(p => 
        p.name.toLowerCase().includes('plug') || 
        p.name.toLowerCase().includes('brass')
      )
      
      console.log(`\n🔍 Products containing "plug" or "brass": ${plugProducts.length}`)
      plugProducts.forEach(p => {
        console.log(`  ⭐ ${p.name} (${p.sku})`)
      })
      
      if (plugProducts.length === 0) {
        console.log('\n💡 INSIGHT: No products actually contain "PLUG" or "BRASS" in the name!')
        console.log('   This might explain why the hybrid function finds no matches.')
        console.log('   The similarity threshold might be too high for the actual product names.')
      }
    }
    
  } else {
    console.log(`✅ Test function found ${data?.length || 0} matches!`)
    if (data && data.length > 0) {
      data.forEach(match => {
        console.log(`  - ${match.name} (${match.sku}) - Score: ${match.final_score}`)
        console.log(`    Trigram: ${match.trigram_score}, Alias: ${match.alias_score}`)
      })
    } else {
      console.log('   Even without RLS, no matches found. This suggests the algorithm or data issue.')
    }
  }
}

runTest()