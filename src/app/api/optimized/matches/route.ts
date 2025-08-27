/**
 * Optimized Matches API Route with Comprehensive Caching
 * Integrates match result caching for major performance improvements
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOptimizedMatches } from '@/lib/optimization-service'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { organizationId, userId, threshold = 0.2, batchSize = 50 } = await request.json()

    if (!organizationId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing organization ID or user ID' },
        { status: 400 }
      )
    }

    console.log(`🚀 Optimized matches request for org: ${organizationId}, threshold: ${threshold}`)

    // Get all line items for this organization that need matches
    const { data: allLineItems, error: fetchError } = await supabaseAdmin
      .from('line_items')
      .select('id, raw_text, parsed_data')
      .eq('organization_id', organizationId)
      .limit(batchSize)

    if (fetchError) {
      console.error('Error fetching line items:', fetchError)
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      )
    }

    // Filter out line items that already have matches
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

    const existingMatchLineItemIds = new Set((existingMatches || []).map((m: any) => m.line_item_id))
    const lineItems = (allLineItems || [])
      .filter((item: any) => !existingMatchLineItemIds.has(item.id))
      .map((item: any) => ({
        id: item.id,
        text: item.raw_text || JSON.stringify(item.parsed_data)
      }))

    if (lineItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No line items need matching',
        generatedCount: 0,
        totalProcessed: 0,
        cached: 0,
        results: []
      })
    }

    console.log(`Found ${lineItems.length} line items without matches`)

    // Use optimized matching with comprehensive caching
    const startTime = Date.now()
    const result = await getOptimizedMatches(lineItems, organizationId, threshold)
    const processingTime = Date.now() - startTime

    // Store the matches in database
    const matchesToStore: any[] = []
    let generatedCount = 0

    for (const [lineItemId, matches] of result.matches.entries()) {
      for (const match of matches) {
        if (match.confidence_score >= threshold) {
          matchesToStore.push({
            line_item_id: lineItemId,
            product_id: match.product_id,
            confidence_score: match.confidence_score,
            reasoning: match.reasoning,
            match_source: match.match_source,
            tier_used: match.tier_used,
            organization_id: organizationId,
            created_by: userId
          })
          generatedCount++
        }
      }
    }

    // Batch insert matches
    if (matchesToStore.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('matches')
        .insert(matchesToStore)

      if (insertError) {
        console.error('Error inserting matches:', insertError)
        return NextResponse.json(
          { success: false, error: 'Failed to store matches' },
          { status: 500 }
        )
      }
    }

    console.log(`✅ Optimized matching completed: ${generatedCount} matches generated in ${processingTime}ms`)

    return NextResponse.json({
      success: true,
      generatedCount,
      totalProcessed: lineItems.length,
      cached: result.metrics.cached,
      results: matchesToStore,
      performance: {
        processingTime,
        averageTimePerItem: (processingTime / lineItems.length).toFixed(2) + 'ms',
        cacheHitRate: result.metrics.hitRate,
        optimization: 'ENABLED'
      },
      cacheMetrics: result.metrics
    })

  } catch (error) {
    console.error('Optimized matches API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organization_id')
    
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'organization_id parameter is required' },
        { status: 400 }
      )
    }

    // Get match cache statistics
    const { matchCache } = await import('@/lib/match-cache')
    const cacheStats = matchCache.getStats()

    // Get recent match performance
    const { data: recentMatches, error } = await supabaseAdmin
      .from('matches')
      .select('created_at, confidence_score, match_source, tier_used')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching match statistics:', error)
    }

    const matchSources = (recentMatches || []).reduce((acc: any, match: any) => {
      acc[match.match_source] = (acc[match.match_source] || 0) + 1
      return acc
    }, {})

    const avgConfidence = recentMatches && recentMatches.length > 0 
      ? (recentMatches.reduce((sum: number, match: any) => sum + match.confidence_score, 0) / recentMatches.length).toFixed(3)
      : 'N/A'

    return NextResponse.json({
      success: true,
      data: {
        cacheStats,
        recentMatches: {
          total: recentMatches?.length || 0,
          averageConfidence: avgConfidence,
          sources: matchSources,
          last24Hours: (recentMatches || []).filter((match: any) => 
            new Date(match.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
          ).length
        },
        optimization: {
          status: 'ACTIVE',
          cacheEnabled: true,
          intelligentMatching: true,
          tierSystem: 'HYBRID_4_TIER'
        }
      }
    })

  } catch (error) {
    console.error('Match statistics API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get match statistics' },
      { status: 500 }
    )
  }
}