const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

async function applyMigration() {
  console.log('📦 Applying company_name migration...')
  
  try {
    // Read the migration SQL
    const sql = fs.readFileSync('supabase/migrations/20250824000001_add_company_name_to_line_items.sql', 'utf8')
    
    console.log('📋 MANUAL MIGRATION REQUIRED:')
    console.log('1. Go to Supabase Dashboard > SQL Editor')
    console.log('2. Copy and paste the SQL below:')
    console.log('3. Run the SQL')
    console.log('')
    console.log('--- SQL TO RUN ---')
    console.log(sql)
    console.log('--- END SQL ---')
    console.log('')
    console.log('✅ After running this SQL, the migration will be complete!')
    
  } catch (error) {
    console.error('❌ Error reading migration file:', error)
  }
}

applyMigration()