const { createClient } = require('@supabase/supabase-js')

// Test with authenticated user (anon key + login)
const supabaseAuth = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODA4MzIsImV4cCI6MjA3MTQ1NjgzMn0.B-qWDnZRkxToVhhpMDVgXD38fzOptalciTDHxXOkgHI'
)

// Test with service role
const supabaseService = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

async function debugAuth() {
  console.log('=== DEBUG: Testing authentication and organization context ===')
  
  // First, try to login as justin@pathopt.com and test from there
  console.log('\n1. Attempting to sign in as justin@pathopt.com...')
  const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
    email: 'justin@pathopt.com',
    password: 'pathopt123!'  // Using the password from earlier in conversation
  })
  
  if (authError) {
    console.error('Auth error:', authError)
    console.log('Cannot test authenticated functions without login. Let me check with service role.')
  } else {
    console.log('✅ Successfully logged in!')
    console.log('User ID:', authData.user.id)
    
    // Now check the profile and organization
    console.log('\n2. Checking profile and organization...')
    const { data: profile, error: profileError } = await supabaseAuth
      .from('profiles')
      .select('*')
      .single()
    
    if (profileError) {
      console.error('Profile error:', profileError)
    } else {
      console.log('Profile found:')
      console.log(`  - ID: ${profile.id}`)
      console.log(`  - Email: ${profile.email}`)
      console.log(`  - Organization ID: ${profile.organization_id}`)
      console.log(`  - Full Name: ${profile.full_name}`)
    }
    
    // Test products visibility with authenticated user
    console.log('\n3. Testing products visibility as authenticated user...')
    const { data: products, error: productsError } = await supabaseAuth
      .from('products')
      .select('id, name, sku, organization_id')
      .limit(3)
    
    if (productsError) {
      console.error('Products error:', productsError)
    } else {
      console.log(`Found ${products?.length || 0} products`)
      products?.forEach(p => {
        console.log(`  - ${p.name} (org: ${p.organization_id})`)
      })
    }
    
    // Test hybrid function as authenticated user
    console.log('\n4. Testing hybrid function as authenticated user...')
    const { data: hybridResults, error: hybridError } = await supabaseAuth.rpc('hybrid_product_match', {
      query_text: 'PLUG BRASS',
      limit_count: 5,
      threshold: 0.01
    })
    
    if (hybridError) {
      console.error('Hybrid error:', hybridError)
    } else {
      console.log(`Hybrid function found ${hybridResults?.length || 0} matches`)
      hybridResults?.forEach(match => {
        console.log(`  - ${match.name} (${match.sku}) - Score: ${match.final_score}`)
      })
    }
  }
}

debugAuth()