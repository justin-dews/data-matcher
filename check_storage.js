const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkStorage() {
    console.log('🔍 Checking storage configuration...')
    
    // Check if documents bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    console.log('📦 Available buckets:', buckets?.map(b => b.name))
    if (bucketsError) console.log('❌ Buckets error:', bucketsError)
    
    // Try to create documents bucket if it doesn't exist  
    const documentsBucket = buckets?.find(b => b.name === 'documents')
    if (!documentsBucket) {
        console.log('🆕 Creating documents bucket...')
        const { data, error } = await supabase.storage.createBucket('documents', {
            public: false,
            allowedMimeTypes: ['application/pdf'],
            fileSizeLimit: 50 * 1024 * 1024 // 50MB
        })
        
        if (error) {
            console.log('❌ Failed to create bucket:', error)
        } else {
            console.log('✅ Created documents bucket')
        }
    } else {
        console.log('✅ Documents bucket exists')
    }
}

checkStorage().catch(console.error)