const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

async function testHybridDirect() {
  console.log('Testing hybrid_product_match function directly...')
  
  const { data, error } = await supabase.rpc('hybrid_product_match', {
    query_text: 'PLUG BRASS',
    limit_count: 5,
    threshold: 0.1
  })
  
  if (error) {
    console.error('Error calling hybrid_product_match:', error)
  } else {
    console.log('Results from hybrid_product_match:')
    console.log(`Found ${data?.length || 0} matches`)
    if (data && data.length > 0) {
      data.forEach(match => {
        console.log(`- ${match.name} (${match.sku}) - Score: ${match.final_score}`)
        console.log(`  Vector: ${match.vector_score}, Trigram: ${match.trigram_score}, Alias: ${match.alias_score}`)
      })
    } else {
      console.log('No matches found - this suggests an issue with the function or data.')
    }
  }
}

testHybridDirect()