const { createClient } = require('@supabase/supabase-js')

// Use anon key like the frontend does
const supabase = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODA4MzIsImV4cCI6MjA3MTQ1NjgzMn0.B-qWDnZRkxToVhhpMDVgXD38fzOptalciTDHxXOkgHI'
)

async function testAsAuthenticatedUser() {
  console.log('=== Testing Hybrid Function as Authenticated User ===')
  
  // First, try to login
  console.log('\n1. Attempting to sign in...')
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'justin@pathopt.com',
    password: 'pathopt123!'  // Try the password we used before
  })
  
  if (authError) {
    console.error('❌ Auth failed:', authError.message)
    console.log('   Cannot test without authentication')
    return
  }
  
  console.log('✅ Successfully authenticated!')
  console.log(`   User ID: ${authData.user.id}`)
  
  // Test if we can see products as authenticated user
  console.log('\n2. Testing product access as authenticated user:')
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, sku')
    .limit(5)
  
  if (productsError) {
    console.error('❌ Cannot access products as authenticated user:', productsError)
    return
  }
  
  console.log(`✅ Can see ${products.length} products as authenticated user:`)
  products.forEach(p => {
    console.log(`   - ${p.name} (${p.sku})`)
  })
  
  // Test hybrid function with various queries from your line items
  console.log('\n3. Testing hybrid function with your actual line items:')
  
  const testQueries = [
    'MET CLASS 8 HEX NUT M5X0.8 - ZC',  // Should match hex nuts in catalog
    'HARDENED FLAT WASHER M18',         // Might match washer-like products
    'HEX HD CAP SCR M16X1.50',         // Hex head screws
    'STEEL NUT',                        // Generic, should match steel nuts
    'ZINC',                             // Many products have zinc coating
    'M8',                               // Common metric size
    'NUT'                               // Very generic
  ]
  
  for (const query of testQueries) {
    console.log(`\n🔍 Testing: "${query}"`)
    
    const { data: matches, error: matchError } = await supabase.rpc('hybrid_product_match', {
      query_text: query,
      limit_count: 3,
      threshold: 0.05  // Very low threshold
    })
    
    if (matchError) {
      console.error(`   ❌ Error: ${matchError.message}`)
      if (matchError.code) {
        console.error(`   Code: ${matchError.code}`)
      }
    } else {
      console.log(`   ✅ Found ${matches?.length || 0} matches`)
      matches?.slice(0, 2).forEach(match => {
        console.log(`      - ${match.name} (${match.sku}) - Score: ${match.final_score.toFixed(3)}`)
        console.log(`        T:${match.trigram_score.toFixed(3)} A:${match.alias_score.toFixed(3)}`)
      })
    }
  }
  
  // Sign out when done
  await supabase.auth.signOut()
  console.log('\n✅ Signed out')
}

testAsAuthenticatedUser()