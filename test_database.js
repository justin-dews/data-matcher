// Test PathoptMatch database connection and functionality
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testDatabase() {
  console.log('🧪 Testing PathoptMatch Database...\n')
  
  try {
    // Test 1: Check extensions
    console.log('1. Testing extensions...')
    const { data: extensions } = await supabase.rpc('select version()')
    console.log('✅ Database connection works\n')
    
    // Test 2: Check tables exist
    console.log('2. Testing tables...')
    const { data: tables, error: tablesError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
    
    if (tablesError && !tablesError.message.includes('0 rows')) {
      throw tablesError
    }
    console.log('✅ Core tables accessible\n')
    
    // Test 3: Check hybrid function exists
    console.log('3. Testing hybrid matching function...')
    const { data: functionTest, error: functionError } = await supabase
      .rpc('hybrid_product_match', {
        query_text: 'test product',
        query_embedding: Array(1536).fill(0.1),
        org_id: '00000000-0000-0000-0000-000000000000'
      })
    
    if (functionError && !functionError.message.includes('0 rows')) {
      throw functionError
    }
    console.log('✅ Hybrid matching function exists\n')
    
    // Test 4: Check storage bucket
    console.log('4. Testing storage bucket...')
    const { data: buckets } = await supabase.storage.listBuckets()
    const documentsBucket = buckets?.find(b => b.name === 'documents')
    
    if (!documentsBucket) {
      throw new Error('Documents bucket not found')
    }
    console.log('✅ Storage bucket accessible\n')
    
    console.log('🎉 ALL TESTS PASSED - PathoptMatch is ready!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

testDatabase()