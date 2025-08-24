const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

async function debugServiceRole() {
  console.log('=== DEBUG: Service Role Profile and RLS Issue ===')
  
  // Check what auth.uid() returns for service role
  console.log('\n1. Checking what auth.uid() returns for service role:')
  const { data: uidResult, error: uidError } = await supabase.rpc('exec_sql', {
    query: 'SELECT auth.uid() as current_user_id'
  })
  
  if (uidError) {
    console.error('UID check error:', uidError)
    // Service role auth.uid() returns null, which explains the issue!
    console.log('🔍 HYPOTHESIS: Service role auth.uid() returns NULL')
    console.log('   This means RLS query (SELECT organization_id FROM profiles WHERE id = auth.uid()) returns NULL')
    console.log('   Therefore, products are filtered out even though service role can see them directly')
  }

  // Check all profiles to see what users exist
  console.log('\n2. Checking all profiles in database:')
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, organization_id, full_name')
  
  if (profilesError) {
    console.error('Profiles error:', profilesError)
  } else {
    console.log(`Found ${profiles?.length || 0} profiles:`)
    profiles?.forEach(p => {
      console.log(`  - ${p.email} (${p.id}) -> org: ${p.organization_id}`)
    })
  }

  // Check organizations
  console.log('\n3. Checking organizations:')
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('*')
  
  if (orgsError) {
    console.error('Organizations error:', orgsError)
  } else {
    console.log(`Found ${orgs?.length || 0} organizations:`)
    orgs?.forEach(org => {
      console.log(`  - ${org.name} (${org.id})`)
    })
  }

  console.log('\n🔍 ROOT CAUSE ANALYSIS:')
  console.log('The hybrid_product_match function uses RLS with:')
  console.log('  WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())')
  console.log('')
  console.log('When called with service_role:')
  console.log('  1. auth.uid() returns NULL (service role has no user context)')
  console.log('  2. The subquery returns NULL')
  console.log('  3. WHERE organization_id = NULL matches nothing')
  console.log('  4. Function returns 0 results')
  console.log('')
  console.log('SOLUTION: Need to test with actual authenticated user, not service role!')
}

debugServiceRole()