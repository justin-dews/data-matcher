const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

async function testSimpleMatch() {
  console.log('=== Testing Simple Matching Function ===')
  
  try {
    // First, create the simple test function (try reading from file)
    console.log('\n1. Creating simple test function...')
    const sql = fs.readFileSync('create-simple-match-test.sql', 'utf8')
    console.log('   SQL function prepared (manual execution needed)')
    
    // Test our known good matches
    console.log('\n2. Testing known good matches:')
    
    const testCases = [
      {
        query: 'PLUG, HEX HD, BRASS PIPE, 1/4" NPT',
        expected: 'BRASS PIPE HEX PLUG 1/4" MALE'
      },
      {
        query: 'MET HARDENED FLAT WASHER M18 ZINC PL',
        expected: 'FLAT WASHER METRIC ZINC M18'
      },
      {
        query: 'MET PH PN HD MACH SCR M5X0.8X20MM',
        expected: 'METRIC MACH. SCREW PHILLIPS PAN HD M5-0.80 X 20'
      }
    ]
    
    for (const testCase of testCases) {
      console.log(`\n🔍 Testing: "${testCase.query}"`)
      console.log(`   Expected: "${testCase.expected}"`)
      
      try {
        const { data, error } = await supabase.rpc('simple_product_match_test', {
          query_text: testCase.query,
          org_id: '00000000-0000-0000-0000-000000000001',
          limit_count: 5,
          threshold: 0.01
        })
        
        if (error) {
          if (error.code === 'PGRST202') {
            console.log('   ❌ Function does not exist yet - needs manual creation in Supabase Dashboard')
          } else {
            console.error(`   ❌ Error: ${error.message}`)
          }
        } else {
          console.log(`   ✅ Found ${data?.length || 0} matches:`)
          data?.forEach(match => {
            console.log(`      - ${match.name} (${match.sku})`)
            console.log(`        Name sim: ${match.name_similarity.toFixed(3)}, SKU sim: ${match.sku_similarity.toFixed(3)}, Max: ${match.max_similarity.toFixed(3)}`)
          })
          
          // Check if expected match is in results
          const expectedFound = data?.some(match => match.name === testCase.expected)
          console.log(`   Expected match found: ${expectedFound ? '✅ YES' : '❌ NO'}`)
        }
      } catch (e) {
        console.error(`   ❌ Test error: ${e.message}`)
      }
    }
    
    console.log('\n📋 MANUAL STEPS NEEDED:')
    console.log('1. Go to Supabase Dashboard > SQL Editor')
    console.log('2. Copy/paste the contents of create-simple-match-test.sql')
    console.log('3. Run the SQL to create the test function')
    console.log('4. Re-run this script to test matching')
    console.log('')
    console.log('If the simple function works but hybrid_product_match doesn\'t,')
    console.log('then the issue is specifically with the hybrid function\'s RLS context or logic.')
    
  } catch (error) {
    console.error('❌ Script error:', error)
  }
}

testSimpleMatch()