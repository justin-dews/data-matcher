import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimiters } from '@/lib/rate-limiter'
import { withAuthAndRateLimit, AuthContext } from '@/lib/auth-validation'

async function generateMatchesHandler(request: NextRequest, auth: AuthContext): Promise<NextResponse> {
  try {
    console.log(`🎯 Generating matches for user ${auth.user.email} in org ${auth.profile.organization_id}`)

    // Get all line items for this organization
    const { data: allLineItems, error: fetchError } = await supabaseAdmin
      .from('line_items')
      .select('id, raw_text, parsed_data')
      .eq('organization_id', auth.profile.organization_id)
      .limit(100)

    if (fetchError) {
      console.error('Error fetching line items:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch line items' },
        { status: 500 }
      )
    }

    // Get existing matches to filter out line items that already have matches
    const { data: existingMatches, error: matchFetchError } = await supabaseAdmin
      .from('matches')
      .select('line_item_id')
      .eq('organization_id', auth.profile.organization_id)

    if (matchFetchError) {
      console.error('Error fetching existing matches:', matchFetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch existing matches' },
        { status: 500 }
      )
    }

    // Filter out line items that already have matches
    const existingMatchLineItemIds = new Set(existingMatches?.map(m => m.line_item_id) || [])
    const lineItems = allLineItems?.filter(item => !existingMatchLineItemIds.has(item.id)) || []

    console.log(`Found ${lineItems.length} line items without matches (out of ${allLineItems?.length} total)`)

    let generatedCount = 0
    const results = []

    // Generate matches for each line item
    for (const lineItem of lineItems) {
      try {
        // Get the text to match
        const matchText = lineItem.parsed_data?.name || lineItem.raw_text
        
        console.log(`🔍 Generating matches for: "${matchText}"`)
        
        // Call the tiered matching function
        const { data: candidates, error: matchError } = await supabaseAdmin.rpc('hybrid_product_match_tiered', {
          query_text: matchText,
          limit_count: 5,
          threshold: 0.2 // Confidence threshold
        })

        if (matchError) {
          console.error(`Match error for "${matchText}":`, matchError)
          continue
        }

        if (candidates && candidates.length > 0) {
          const bestCandidate = candidates[0]
          
          // Only create matches above threshold
          if (bestCandidate.final_score >= 0.2) {
            // Insert match record
            const { error: insertError } = await supabaseAdmin
              .from('matches')
              .insert({
                line_item_id: lineItem.id,
                product_id: bestCandidate.product_id,
                organization_id: auth.profile.organization_id,
                status: 'pending',
                confidence_score: bestCandidate.final_score,
                vector_score: bestCandidate.vector_score,
                trigram_score: bestCandidate.trigram_score,
                fuzzy_score: bestCandidate.fuzzy_score,
                alias_score: bestCandidate.alias_score,
                final_score: bestCandidate.final_score,
                matched_text: bestCandidate.name,
                reasoning: `Auto-generated via ${bestCandidate.matched_via}. ${bestCandidate.matched_via === 'training_exact' ? '🎯 EXACT TRAINING MATCH' : ''}`
              })

            if (insertError) {
              console.error(`Insert error for "${matchText}":`, insertError)
            } else {
              generatedCount++
              results.push({
                lineItemText: matchText,
                matchedProduct: bestCandidate.name,
                score: bestCandidate.final_score,
                matchedVia: bestCandidate.matched_via
              })
              
              console.log(`✅ Match created: "${matchText}" → "${bestCandidate.name}" (${bestCandidate.final_score})`)
            }
          }
        }
      } catch (itemError) {
        console.error(`Error processing line item ${lineItem.id}:`, itemError)
        // Continue with other items
      }
    }

    // Log activity
    await supabaseAdmin
      .from('activity_log')
      .insert({
        organization_id: auth.profile.organization_id,
        user_id: auth.user.id,
        action: 'matches_generated',
        resource_type: 'matches',
        metadata: {
          generated_count: generatedCount,
          total_processed: lineItems.length,
          success_rate: lineItems.length > 0 ? (generatedCount / lineItems.length) * 100 : 0
        }
      })

    console.log(`🎉 Match generation completed: ${generatedCount}/${lineItems.length} matches created`)

    return NextResponse.json({
      success: true,
      generatedCount,
      totalProcessed: lineItems.length,
      results,
      message: `Successfully generated ${generatedCount} matches from ${lineItems.length} line items`
    })

  } catch (error) {
    console.error('Match generation error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error during match generation' },
      { status: 500 }
    )
  }
}

// Export protected handler with authentication and rate limiting
export const POST = withAuthAndRateLimit(rateLimiters.matching, generateMatchesHandler)