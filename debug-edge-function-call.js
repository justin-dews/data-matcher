// Debug script to test edge function directly
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testEdgeFunction() {
  console.log('🔍 Testing parse-pdf edge function...')
  
  try {
    // Test with a dummy storage path
    const testPath = 'test/dummy.pdf'
    
    console.log('📞 Calling edge function with test data...')
    const { data, error } = await supabase.functions.invoke('parse-pdf', {
      body: {
        storagePath: testPath,
        schema: 'invoice'
      }
    })
    
    if (error) {
      console.error('❌ Edge function error:', error)
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText
      })
    } else {
      console.log('✅ Edge function responded:', data)
    }
    
  } catch (err) {
    console.error('❌ Network/JS error:', err)
  }
}

// Test direct HTTP call to edge function
async function testDirectHTTP() {
  console.log('🌐 Testing direct HTTP call to edge function...')
  
  try {
    const response = await fetch('https://theattidfeqxyaexiqwj.supabase.co/functions/v1/parse-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({
        storagePath: 'test/dummy.pdf',
        schema: 'invoice'
      })
    })
    
    console.log('Response status:', response.status)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))
    
    const text = await response.text()
    console.log('Response body:', text)
    
  } catch (err) {
    console.error('❌ Direct HTTP error:', err)
  }
}

console.log('🧪 Starting edge function diagnostics...')
testEdgeFunction().then(() => {
  console.log('\n' + '='.repeat(50))
  return testDirectHTTP()
}).then(() => {
  console.log('🏁 Diagnostics complete')
})