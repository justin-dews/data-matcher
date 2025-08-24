import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const fileName = formData.get('fileName') as string
    
    if (!file || !fileName) {
      return NextResponse.json(
        { error: 'File and fileName are required' },
        { status: 400 }
      )
    }

    console.log('📤 Uploading file via API route:', fileName)

    // Upload using admin client to bypass RLS
    const { data, error } = await supabaseAdmin.storage
      .from('documents')
      .upload(fileName, file)

    if (error) {
      console.error('❌ Storage upload error:', error)
      return NextResponse.json(
        { error: `Upload failed: ${error.message}` },
        { status: 500 }
      )
    }

    console.log('✅ File uploaded successfully:', data)
    
    return NextResponse.json({ 
      success: true,
      data 
    })

  } catch (error) {
    console.error('❌ API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}