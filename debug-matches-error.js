const { createClient } = require('@supabase/supabase-js')

async function debugMatchesError() {
  console.log('🔍 Debugging matches page error...')
  
  const supabase = createClient(
    'https://theattidfeqxyaexiqwj.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODA4MzIsImV4cCI6MjA3MTQ1NjgzMn0.B-qWDnZRkxToVhhpMDVgXD38fzOptalciTDHxXOkgHI'
  )

  try {
    // Test the exact query from the matches page
    console.log('📊 Testing line_items query with matches...')
    const { data, error } = await supabase
      .from('line_items')
      .select(`
        *,
        match:matches(
          *,
          product:products(
            id,
            sku,
            name,
            manufacturer
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('❌ Query failed:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error details:', error.details)
      console.error('Error hint:', error.hint)
      return
    }

    console.log('✅ Query successful!')
    console.log(`📝 Found ${data?.length || 0} line items`)
    
    if (data && data.length > 0) {
      console.log('📋 Sample line item:')
      console.log(JSON.stringify(data[0], null, 2))
    }

    // Test if we have any organizations
    console.log('\n🏢 Testing organizations table...')
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .limit(5)

    if (orgError) {
      console.error('❌ Organizations query failed:', orgError)
    } else {
      console.log('✅ Organizations query successful')
      console.log(`Found ${orgData?.length || 0} organizations`)
      if (orgData && orgData.length > 0) {
        console.log('Sample org:', orgData[0])
      }
    }

    // Test if we have any products
    console.log('\n📦 Testing products table...')
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('id, sku, name, manufacturer')
      .limit(5)

    if (productError) {
      console.error('❌ Products query failed:', productError)
    } else {
      console.log('✅ Products query successful')
      console.log(`Found ${productData?.length || 0} products`)
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error)
  }
}

debugMatchesError()