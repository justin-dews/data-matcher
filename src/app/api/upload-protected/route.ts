import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimiters } from '@/lib/rate-limiter'
import { withAuthAndRateLimit, AuthContext } from '@/lib/auth-validation'

async function uploadHandler(request: NextRequest, auth: AuthContext): Promise<NextResponse> {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const fileName = formData.get('fileName') as string

    if (!file || !fileName) {
      return NextResponse.json(
        { success: false, error: 'File and fileName are required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.includes('pdf')) {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    console.log(`📁 Uploading file: ${fileName} (${file.size} bytes) for user ${auth.user.email}`)

    // Create file path with organization and user context
    const safePath = `${auth.profile.organization_id}/${auth.user.id}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '')}`

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(safePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Storage upload error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to upload file to storage' },
        { status: 500 }
      )
    }

    // Log successful upload
    await supabase
      .from('activity_log')
      .insert({
        organization_id: auth.profile.organization_id,
        user_id: auth.user.id,
        action: 'file_uploaded',
        resource_type: 'document',
        metadata: {
          filename: fileName,
          file_size: file.size,
          storage_path: safePath
        }
      })

    console.log(`✅ File uploaded successfully: ${safePath}`)

    return NextResponse.json({
      success: true,
      data: {
        path: safePath,
        size: file.size,
        type: file.type
      }
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error during upload' },
      { status: 500 }
    )
  }
}

// Export protected handler with authentication and rate limiting
export const POST = withAuthAndRateLimit(rateLimiters.upload, uploadHandler)