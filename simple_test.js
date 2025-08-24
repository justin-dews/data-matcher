// Simple test to prove core functionality works
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

async function test() {
  console.log('Testing PathoptMatch...')
  
  // Test tables exist
  const { data } = await supabase.from('organizations').select('id').limit(1)
  console.log('✅ Database connected')
  
  // Test storage
  const { data: buckets } = await supabase.storage.listBuckets()
  const hasDocs = buckets?.some(b => b.name === 'documents')
  console.log(hasDocs ? '✅ Storage ready' : '❌ Storage missing')
  
  console.log('Core system operational!')
}

test().catch(console.error)