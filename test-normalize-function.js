const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

async function testNormalizeFunction() {
  console.log('Testing normalize_product_text function...')
  
  // Try to call the normalize function directly
  const { data, error } = await supabase.rpc('normalize_product_text', {
    input_text: 'PLUG, HEX HD, BRASS PIPE, 3/8" NPT'
  })
  
  if (error) {
    console.error('Error calling normalize_product_text:', error)
    console.log('This function likely does not exist!')
  } else {
    console.log('Normalize function works:')
    console.log(`Input: PLUG, HEX HD, BRASS PIPE, 3/8" NPT`)
    console.log(`Output: ${data}`)
  }
}

testNormalizeFunction()