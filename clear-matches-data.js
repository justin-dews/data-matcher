const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

async function clearMatchesData() {
  console.log('🧹 Clearing matches data for fresh testing...')
  
  const orgId = '00000000-0000-0000-0000-000000000001'
  
  try {
    // 1. Delete matches
    console.log('\n1. Clearing matches...')
    const { error: matchesError } = await supabase
      .from('matches')
      .delete()
      .eq('organization_id', orgId)
    
    if (matchesError) {
      console.error('Error clearing matches:', matchesError)
    } else {
      console.log('✅ Matches cleared successfully')
    }

    // 2. Delete line items
    console.log('\n2. Clearing line items...')
    const { error: lineItemsError } = await supabase
      .from('line_items')
      .delete()
      .eq('organization_id', orgId)
    
    if (lineItemsError) {
      console.error('Error clearing line items:', lineItemsError)
    } else {
      console.log('✅ Line items cleared successfully')
    }

    // 3. Delete documents
    console.log('\n3. Clearing documents...')
    const { error: documentsError } = await supabase
      .from('documents')
      .delete()
      .eq('organization_id', orgId)
    
    if (documentsError) {
      console.error('Error clearing documents:', documentsError)
    } else {
      console.log('✅ Documents cleared successfully')
    }

    // 4. Clear activity log related to these operations
    console.log('\n4. Clearing related activity logs...')
    const { error: activityError } = await supabase
      .from('activity_log')
      .delete()
      .eq('organization_id', orgId)
      .in('activity_type', ['document_upload', 'pdf_parse', 'match_approved', 'match_rejected'])
    
    if (activityError) {
      console.error('Error clearing activity log:', activityError)
    } else {
      console.log('✅ Activity logs cleared successfully')
    }

    console.log('\n🎉 All matches data cleared! Ready for fresh testing.')
    console.log('\nNext steps:')
    console.log('1. Go to /dashboard/upload')
    console.log('2. Upload a new PDF with product data')
    console.log('3. Wait for parsing to complete')
    console.log('4. Go to /dashboard/matches to test the matching workflow')
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  }
}

clearMatchesData()