const { createClient } = require('@supabase/supabase-js')

// Test both service role and anon key approaches
const supabaseService = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

const supabaseAnon = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODA4MzIsImV4cCI6MjA3MTQ1NjgzMn0.B-qWDnZRkxToVhhpMDVgXD38fzOptalciTDHxXOkgHI'
)

async function finalDiagnostic() {
  console.log('=== FINAL MATCHING DIAGNOSTIC ===')
  
  // 1. Check what line items were just uploaded
  console.log('\n1. 📋 Checking latest line items:')
  const { data: lineItems, error: lineError } = await supabaseService
    .from('line_items')
    .select('id, raw_text, parsed_data')
    .eq('organization_id', '00000000-0000-0000-0000-000000000001')
    .order('created_at', { ascending: false })
    .limit(5)
  
  if (lineError) {
    console.error('Cannot get line items:', lineError)
    return
  }
  
  console.log(`Found ${lineItems.length} recent line items:`)
  lineItems.forEach((item, i) => {
    const displayText = item.parsed_data?.name || item.raw_text
    console.log(`  ${i + 1}. "${displayText}" (ID: ${item.id})`)
  })
  
  // 2. Test the exact same call the frontend makes - with anon key
  console.log('\n2. 🔍 Testing hybrid function with ANON key (like frontend):')
  
  if (lineItems.length > 0) {
    const testItem = lineItems[0]
    const displayText = testItem.parsed_data?.name || testItem.raw_text
    
    console.log(`   Testing: "${displayText}"`)
    
    // This should fail because anon key has no auth context
    const { data: anonResult, error: anonError } = await supabaseAnon.rpc('hybrid_product_match', {
      query_text: displayText,
      limit_count: 5,
      threshold: 0.01
    })
    
    if (anonError) {
      console.error(`   ❌ ANON Error: ${anonError.message}`)
      if (anonError.code) {
        console.error(`   Code: ${anonError.code}`)
      }
      console.log('   This explains why frontend gets 0 results!')
    } else {
      console.log(`   ✅ ANON found ${anonResult?.length || 0} matches`)
      anonResult?.forEach(match => {
        console.log(`      - ${match.name} (${match.sku}) - Score: ${match.final_score}`)
      })
    }
  }
  
  // 3. Test with service role for comparison
  console.log('\n3. 🔧 Testing hybrid function with SERVICE ROLE key:')
  
  if (lineItems.length > 0) {
    const testItem = lineItems[0]
    const displayText = testItem.parsed_data?.name || testItem.raw_text
    
    console.log(`   Testing: "${displayText}"`)
    
    const { data: serviceResult, error: serviceError } = await supabaseService.rpc('hybrid_product_match', {
      query_text: displayText,
      limit_count: 5,
      threshold: 0.01
    })
    
    if (serviceError) {
      console.error(`   ❌ SERVICE Error: ${serviceError.message}`)
    } else {
      console.log(`   ✅ SERVICE found ${serviceResult?.length || 0} matches`)
      serviceResult?.forEach(match => {
        console.log(`      - ${match.name} (${match.sku}) - Score: ${match.final_score}`)
      })
    }
  }
  
  console.log('\n💡 DIAGNOSIS:')
  console.log('   If ANON key fails but SERVICE key works (or both fail),')
  console.log('   the issue is authentication context in the hybrid function.')
  console.log('')
  console.log('   SOLUTION: The hybrid function needs to be modified to work')
  console.log('   with the frontend\'s authentication approach, or the frontend')
  console.log('   needs to authenticate properly before calling the function.')
}

finalDiagnostic()