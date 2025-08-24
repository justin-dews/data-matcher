const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testStorageUpload() {
    console.log('🧪 Testing direct storage upload with service role...')
    
    // Create a simple test file
    const testFile = new Blob(['Hello world'], { type: 'text/plain' })
    const fileName = `b903b88d-e667-4dde-94ff-79dbbb1fcb38/test-${Date.now()}.txt`
    
    console.log('📤 Uploading test file:', fileName)
    
    const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, testFile)
    
    if (error) {
        console.log('❌ Upload failed:', error)
    } else {
        console.log('✅ Upload successful:', data)
    }
}

testStorageUpload().catch(console.error)