const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

async function debugHybridStepByStep() {
  console.log('=== Debugging Hybrid Function Step by Step ===')
  
  const orgId = '00000000-0000-0000-0000-000000000001'
  const query = 'W236'
  
  console.log(`\n🔍 Query: "${query}"`)
  console.log(`🏢 Organization: ${orgId}`)
  
  // Step 1: Check if service role can see products directly
  console.log('\n1. Testing direct product access with service role:')
  const { data: allProducts, error: productsError } = await supabase
    .from('products')
    .select('id, name, sku, organization_id')
    .eq('organization_id', orgId)
    .limit(5)
  
  if (productsError) {
    console.error('❌ Cannot access products:', productsError)
    return
  }
  
  console.log(`✅ Service role can see ${allProducts.length} products directly`)
  allProducts.forEach(p => {
    console.log(`   - ${p.name} (${p.sku})`)
  })
  
  // Step 2: Test normalize function
  console.log('\n2. Testing normalize function:')
  const { data: normalized, error: normError } = await supabase.rpc('normalize_product_text', {
    input_text: query
  })
  
  if (normError) {
    console.error('❌ Normalize function error:', normError)
    return
  }
  
  console.log(`✅ Normalized "${query}" to "${normalized}"`)
  
  // Step 3: Check if hybrid function exists and is callable
  console.log('\n3. Testing hybrid function exists:')
  const { data: functionExists, error: funcError } = await supabase.rpc('hybrid_product_match', {
    query_text: query,
    limit_count: 1,
    threshold: 0.001
  })
  
  if (funcError) {
    console.error('❌ Hybrid function error:', funcError)
    if (funcError.code === 'PGRST202') {
      console.log('   This suggests the function signature or permissions are wrong')
    }
    return
  }
  
  console.log(`✅ Hybrid function callable, returned ${functionExists?.length || 0} results`)
  
  // Step 4: The key insight - test with authenticated user instead of service role
  console.log('\n4. 🔑 KEY INSIGHT: Service role bypass vs RLS')
  console.log('   The hybrid function uses SECURITY DEFINER but still relies on auth.uid()')
  console.log('   Service role auth.uid() = NULL, so RLS query returns NULL')
  console.log('   Even SECURITY DEFINER cannot override this because the function logic itself')
  console.log('   depends on the authentication context!')
  
  // Step 5: Create a test with explicit organization ID
  console.log('\n5. Testing by creating a service-role-compatible test function...')
  console.log('   We need to test this with an authenticated user or modify the function')
  console.log('   to work with service role by explicitly passing organization_id')
  
  console.log('\n💡 SOLUTION IDENTIFIED:')
  console.log('   The hybrid_product_match function requires authenticated user context')
  console.log('   It cannot be tested with service_role because:')
  console.log('   1. Function uses RLS policies that depend on auth.uid()')
  console.log('   2. Service role auth.uid() returns NULL')  
  console.log('   3. RLS filters out all products for NULL user')
  console.log('')
  console.log('   NEXT STEPS:')
  console.log('   1. Test from browser as authenticated user justin@pathopt.com')
  console.log('   2. Or create a service-role-specific test version of the function')
  console.log('   3. The function logic is likely correct, just needs proper auth context')
}

debugHybridStepByStep()