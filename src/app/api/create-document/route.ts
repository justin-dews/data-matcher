import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { user_id, filename, file_path } = await request.json()
    
    if (!user_id || !filename || !file_path) {
      return NextResponse.json(
        { error: 'user_id, filename, and file_path are required' },
        { status: 400 }
      )
    }

    console.log('💾 Creating document record via API:', { user_id, filename, file_path })

    // Get user's organization ID from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user_id)
      .single()
      
    if (profileError || !profile) {
      console.error('❌ Failed to get user profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to get user profile' },
        { status: 400 }
      )
    }

    // Create document using admin client to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('documents')
      .insert({
        organization_id: profile.organization_id,
        user_id,
        filename,
        file_path,
        status: 'parsing'
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Database insert error:', error)
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }

    console.log('✅ Document record created successfully:', data.id)
    
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