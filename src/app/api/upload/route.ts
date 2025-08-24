import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const userId = formData.get('userId') as string
    const organizationId = formData.get('organizationId') as string
    const preset = formData.get('preset') as string

    if (!file || !userId || !organizationId) {
      return NextResponse.json(
        { error: 'File, user ID, and organization ID are required' },
        { status: 400 }
      )
    }

    // Ensure organization and profile exist (create if needed)
    try {
      // Create organization if it doesn't exist
      const { error: orgError } = await supabaseAdmin
        .from('organizations')
        .upsert({
          id: organizationId,
          name: 'Test Organization',
          slug: 'test-org',
          settings: {}
        })

      if (orgError) {
        console.error('Failed to create organization:', orgError)
      }

      // Create profile if it doesn't exist
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          organization_id: organizationId,
          email: 'test@test.com',
          full_name: 'Test User',
          role: 'admin'
        })

      if (profileError) {
        console.error('Failed to create profile:', profileError)
      }
    } catch (setupError) {
      console.error('Failed to setup user/org:', setupError)
      // Continue anyway - might already exist
    }

    // Validate file type and size
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      )
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB
      return NextResponse.json(
        { error: 'File size must be less than 50MB' },
        { status: 400 }
      )
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${userId}/${fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('documents')
      .upload(filePath, file)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Create document record
    const { data: documentData, error: documentError } = await supabaseAdmin
      .from('documents')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        filename: file.name,
        file_size: file.size,
        file_path: filePath,
        status: 'uploading',
      })
      .select()
      .single()

    if (documentError) {
      console.error('Document creation error:', documentError)
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      )
    }

    // Call parse-pdf Edge Function
    try {
      console.log('Calling parse-pdf function with:', {
        document_id: documentData.id,
        file_path: filePath,
        preset: preset || 'invoice',
      })
      
      const { data: parseData, error: parseError } = await supabaseAdmin.functions
        .invoke('parse-pdf', {
          body: {
            document_id: documentData.id,
            file_path: filePath,
            preset: preset || 'invoice',
          },
        })

      console.log('Parse function response:', { parseData, parseError })

      if (parseError) {
        console.error('Parse function error:', parseError)
        // Update document status to failed
        await supabaseAdmin
          .from('documents')
          .update({ 
            status: 'failed', 
            error_message: parseError.message 
          })
          .eq('id', documentData.id)
      } else if (parseData?.success) {
        // Parse function completed successfully
        console.log('Parse completed successfully, setting status to parsed')
        await supabaseAdmin
          .from('documents')
          .update({ 
            status: 'parsed',
            parse_result: parseData.data
          })
          .eq('id', documentData.id)
      } else {
        // Parse function started but not completed yet
        console.log('Parse function started, setting status to parsing')
        await supabaseAdmin
          .from('documents')
          .update({ status: 'parsing' })
          .eq('id', documentData.id)
      }
    } catch (error) {
      console.error('Parse function call error:', error)
      await supabaseAdmin
        .from('documents')
        .update({ 
          status: 'failed', 
          error_message: 'Failed to start parsing' 
        })
        .eq('id', documentData.id)
    }

    return NextResponse.json({
      success: true,
      documentId: documentData.id,
      filePath,
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}