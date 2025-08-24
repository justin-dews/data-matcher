const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixStoragePolicy() {
    console.log('🔧 Fixing storage policies...')
    
    // Create permissive policies for documents bucket
    const queries = [
        // Drop existing policies
        `DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;`,
        `DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;`,
        `DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;`,
        
        // Create new permissive policies
        `CREATE POLICY "Allow authenticated uploads" 
         ON storage.objects FOR INSERT 
         WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');`,
         
        `CREATE POLICY "Allow authenticated reads" 
         ON storage.objects FOR SELECT 
         USING (bucket_id = 'documents' AND auth.role() = 'authenticated');`,
         
        `CREATE POLICY "Allow authenticated deletes" 
         ON storage.objects FOR DELETE 
         USING (bucket_id = 'documents' AND auth.role() = 'authenticated');`
    ]
    
    for (const query of queries) {
        console.log('📝 Executing:', query.substring(0, 60) + '...')
        const { data, error } = await supabase.rpc('execute_sql', { query })
        
        if (error) {
            console.log('❌ Error:', error)
        } else {
            console.log('✅ Success')
        }
    }
}

fixStoragePolicy().catch(console.error)