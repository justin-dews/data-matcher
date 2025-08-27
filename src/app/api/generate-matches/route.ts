import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateMatchesBatch } from '@/lib/db-optimizations'

export async function POST(request: NextRequest) {
  try {
    const { organizationId, userId } = await request.json()

    if (!organizationId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing organization ID or user ID' },
        { status: 400 }
      )
    }

    // Get all line items for this organization
    const { data: allLineItems, error: fetchError } = await supabaseAdmin
      .from('line_items')
      .select('id, raw_text, parsed_data')
      .eq('organization_id', organizationId)
      .limit(100)

    if (fetchError) {
      console.error('Error fetching line items:', fetchError)
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      )
    }

    // Get existing matches to filter out line items that already have matches
    const { data: existingMatches, error: matchFetchError } = await supabaseAdmin
      .from('matches')
      .select('line_item_id')
      .eq('organization_id', organizationId)

    if (matchFetchError) {
      console.error('Error fetching existing matches:', matchFetchError)
      return NextResponse.json(
        { success: false, error: matchFetchError.message },
        { status: 500 }
      )
    }

    // Filter out line items that already have matches
    const existingMatchLineItemIds = new Set((existingMatches || []).map((m: any) => m.line_item_id))
    const lineItems = (allLineItems || []).filter((item: any) => !existingMatchLineItemIds.has(item.id))

    console.log(`Found ${lineItems.length} line items without matches (out of ${allLineItems?.length} total)`)

    let generatedCount = 0
    const results: any[] = []

    console.log(`🚀 Starting optimized batch match generation for ${lineItems.length} line items`)
    
    // Use optimized batch processing instead of sequential processing
    const batchResult = await generateMatchesBatch(lineItems, organizationId, 0.2)
    
    generatedCount = batchResult.generatedCount
    results.push(...batchResult.results)
    
    console.log(`✅ Optimized batch processing completed: ${generatedCount} matches generated`)

    return NextResponse.json({
      success: true,
      generatedCount,
      totalProcessed: lineItems.length,
      results
    })

  } catch (error) {
    console.error('Generate matches API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}