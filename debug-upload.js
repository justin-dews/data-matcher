const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function generateUUID() {
  return crypto.randomUUID()
}

// Configure Supabase client
const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugUploadProcess() {
  console.log('🔍 Starting debug process...')
  
  try {
    // Step 1: Test database connection
    console.log('\n📊 Testing database connection...')
    const { data: testData, error: testError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1)
    
    if (testError) {
      console.error('❌ Database error:', testError)
      return
    }
    console.log('✅ Database connected. Sample org:', testData)

    // Step 2: Test storage access
    console.log('\n🗄️ Testing storage access...')
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
    
    if (bucketError) {
      console.error('❌ Storage error:', bucketError)
      return
    }
    console.log('✅ Storage connected. Buckets:', buckets.map(b => b.name))

    // Step 3: Upload a real PDF file for testing
    console.log('\n📄 Uploading test PDF...')
    const testPdfPath = './test-simple.pdf'
    const testBuffer = fs.readFileSync(testPdfPath)
    const testFileName = `debug-test-${Date.now()}.pdf`
    
    console.log(`PDF file size: ${testBuffer.length} bytes`)
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(testFileName, testBuffer)
    
    if (uploadError) {
      console.error('❌ Upload error:', uploadError)
      return
    }
    console.log('✅ Test file uploaded:', uploadData)

    // Step 4: Create a document record first
    console.log('\n📝 Creating document record...')
    const testDocumentId = generateUUID()
    
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        id: testDocumentId,
        user_id: '00000000-0000-0000-0000-000000000001', // test user
        organization_id: '00000000-0000-0000-0000-000000000001',
        filename: testFileName,
        file_size: testBuffer.length,
        file_path: testFileName,
        status: 'uploading'
      })
      .select()
      .single()
    
    if (docError) {
      console.error('❌ Failed to create document record:', docError)
      return
    }
    console.log('✅ Document record created:', docData.id)
    
    // Step 5: Test edge function with short timeout
    console.log('\n⚡ Testing edge function call...')
    
    const startTime = Date.now()
    
    // Use a timeout wrapper
    const functionCall = supabase.functions.invoke('parse-pdf', {
      body: {
        document_id: testDocumentId,
        file_path: testFileName,
        preset: 'invoice'
      }
    })
    
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Function timeout after 30s')), 30000)
    })
    
    try {
      const result = await Promise.race([functionCall, timeout])
      const elapsed = Date.now() - startTime
      console.log(`✅ Function completed in ${elapsed}ms`)
      console.log('Function result:', JSON.stringify(result, null, 2))
    } catch (timeoutError) {
      const elapsed = Date.now() - startTime
      console.log(`⏰ Function timed out after ${elapsed}ms`)
      console.log('Timeout error:', timeoutError.message)
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test file...')
    await supabase.storage.from('documents').remove([testFileName])
    
  } catch (error) {
    console.error('💥 Unexpected error:', error)
  }
}

debugUploadProcess()