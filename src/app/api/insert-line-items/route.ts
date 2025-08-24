import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { lineItems } = await request.json()
    
    if (!lineItems || !Array.isArray(lineItems)) {
      return NextResponse.json(
        { error: 'lineItems array is required' },
        { status: 400 }
      )
    }

    console.log('📝 Inserting line items via API:', lineItems.length, 'items')

    // Insert line items using admin client to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('line_items')
      .insert(lineItems)
      .select()

    if (error) {
      console.error('❌ Line items insert error:', error)
      return NextResponse.json(
        { error: `Line items error: ${error.message}` },
        { status: 500 }
      )
    }

    console.log('✅ Line items inserted successfully:', data.length)
    
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