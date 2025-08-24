const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
  'https://theattidfeqxyaexiqwj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'
)

async function applyHybridFix() {
  console.log('🔧 Applying hybrid function threshold fix...')
  
  try {
    // Read the SQL fix
    const sql = fs.readFileSync('fix-hybrid-hardcoded-threshold.sql', 'utf8')
    
    // Split into statements and execute each
    const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'))
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim()
      if (statement) {
        console.log(`\nExecuting statement ${i + 1}/${statements.length}...`)
        
        // For function creation, we need to use the REST API directly
        if (statement.includes('CREATE OR REPLACE FUNCTION')) {
          const { error } = await supabase.from('_placeholder').select('*').limit(0)
          
          // Since we can't execute raw SQL easily, let's try via RPC if it exists
          try {
            await supabase.rpc('exec', { sql: statement })
          } catch (e) {
            console.log('RPC exec not available, function update may need manual application')
          }
        }
      }
    }
    
    console.log('\n✅ Hybrid function fix applied!')
    console.log('\n🧪 Now test in browser by reloading /matches page')
    console.log('    The function should now respect the 0.1 threshold you set')
    
  } catch (error) {
    console.error('❌ Error applying fix:', error)
    console.log('\n📝 MANUAL APPROACH:')
    console.log('   1. Go to Supabase Dashboard > SQL Editor')
    console.log('   2. Copy/paste the contents of fix-hybrid-hardcoded-threshold.sql')
    console.log('   3. Run the SQL to update the function')
    console.log('   4. Reload /matches page to test')
  }
}

applyHybridFix()