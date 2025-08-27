import { supabase, supabaseAdmin } from './supabase'
import { LineItem, Match, MatchCandidate } from './utils'

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const BATCH_SIZE = 50

interface CacheEntry<T> {
  data: T
  timestamp: number
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>()

  set<T>(key: string, data: T, ttl: number = CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + ttl
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry || Date.now() > entry.timestamp) {
      this.cache.delete(key)
      return null
    }
    return entry.data
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }
}

export const queryCache = new QueryCache()

// Cursor-based pagination interface
export interface CursorPaginationParams {
  limit?: number
  cursor?: string
  order?: 'asc' | 'desc'
  orderBy?: string
}

export interface CursorPaginationResult<T> {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
  totalCount?: number
}

// 🚀 Optimized line items with matches using database function and cursor pagination
export async function getLineItemsWithMatches(
  organizationId: string,
  pagination?: CursorPaginationParams
): Promise<CursorPaginationResult<LineItem & { match?: Match; product?: any }>> {
  const cacheKey = `line_items_optimized_${organizationId}_${JSON.stringify(pagination)}`
  const cached = queryCache.get<CursorPaginationResult<LineItem & { match?: Match; product?: any }>>(cacheKey)
  
  if (cached) {
    console.log('📋 Cache hit for line items query')
    return cached
  }

  const limit = pagination?.limit || 50
  const offset = pagination?.cursor ? parseInt(pagination.cursor) : 0
  const startTime = performance.now()

  try {
    // 🎯 Use optimized database function for single-query approach
    const { data, error } = await supabaseAdmin
      .rpc('get_line_items_with_matches_optimized', {
        p_organization_id: organizationId,
        p_limit: limit + 1, // Get one extra to check if there are more
        p_offset: offset
      })

    if (error) {
      console.error('🚨 Optimized function failed, using fallback:', error)
      throw error
    }

    const hasMore = (data?.length || 0) > limit
    const items = hasMore ? data?.slice(0, -1) : data
    const nextCursor = hasMore ? (offset + limit).toString() : null

    // Transform database function results to expected interface
    const transformedItems = items?.map((row: any) => ({
      id: row.line_item_id,
      document_id: row.document_id || null,
      organization_id: organizationId,
      line_number: row.line_number || null,
      raw_text: row.line_item_raw_text,
      parsed_data: row.line_item_parsed_data,
      quantity: row.quantity || null,
      unit_price: row.unit_price || null,
      total_price: row.total_price || null,
      company_name: row.line_item_company_name,
      created_at: row.line_item_created_at,
      updated_at: row.updated_at || null,
      match: row.match_id ? {
        id: row.match_id,
        line_item_id: row.line_item_id,
        product_id: row.match_product_id,
        organization_id: organizationId,
        status: row.match_status,
        confidence_score: row.confidence_score || null,
        vector_score: row.vector_score || null,
        trigram_score: row.trigram_score || null,
        fuzzy_score: row.fuzzy_score || null,
        alias_score: row.alias_score || null,
        final_score: row.match_final_score,
        matched_text: row.match_matched_text,
        reasoning: row.match_reasoning,
        reviewed_by: row.reviewed_by || null,
        reviewed_at: row.reviewed_at || null,
        created_at: row.match_created_at || null,
        updated_at: row.match_updated_at || null
      } : null,
      product: row.product_sku ? {
        id: row.match_product_id,
        sku: row.product_sku,
        name: row.product_name,
        manufacturer: row.product_manufacturer,
        category: row.product_category
      } : null
    })) || []

    const result = {
      data: transformedItems,
      nextCursor,
      hasMore,
      totalCount: transformedItems.length
    }

    // Cache for 2 minutes
    queryCache.set(cacheKey, result, 2 * 60 * 1000)
    
    const endTime = performance.now()
    const executionTime = Math.round(endTime - startTime)
    
    console.log(`🚀 Optimized query executed in ${executionTime}ms for ${transformedItems.length} items`)
    
    return result
    
  } catch (error) {
    console.error('🚨 Falling back to standard query approach:', error)
    
    // Fallback to standard approach with LEFT JOINs
    let query = supabase
      .from('line_items')
      .select(`
        id,
        document_id,
        organization_id,
        line_number,
        raw_text,
        parsed_data,
        quantity,
        unit_price,
        total_price,
        company_name,
        created_at,
        updated_at,
        matches!left (
          id,
          product_id,
          status,
          confidence_score,
          vector_score,
          trigram_score,
          fuzzy_score,
          alias_score,
          final_score,
          matched_text,
          reasoning,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at,
          products (
            id,
            sku,
            name,
            manufacturer,
            category
          )
        )
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error: fallbackError } = await query

    if (fallbackError) throw fallbackError

    const transformedItems = data?.map(item => ({
      ...item,
      match: item.matches?.[0] || null,
      product: item.matches?.[0]?.products || null
    })) || []

    const result = {
      data: transformedItems,
      nextCursor: transformedItems.length === limit ? (offset + limit).toString() : null,
      hasMore: transformedItems.length === limit
    }

    queryCache.set(cacheKey, result, 1 * 60 * 1000) // Cache fallback for 1 minute
    return result
  }
}

// 🚀 Ultra-optimized batch match generation using database functions
export async function generateMatchesBatch(
  lineItems: LineItem[],
  organizationId: string,
  threshold: number = 0.2
): Promise<{ success: boolean; generatedCount: number; results: any[] }> {
  if (lineItems.length === 0) {
    return { success: true, generatedCount: 0, results: [] }
  }

  console.log(`🚀 Starting ultra-optimized batch generation for ${lineItems.length} items`)
  const startTime = performance.now()
  
  let generatedCount = 0
  const results: any[] = []
  
  try {
    // 🎯 Use batch hybrid matching function for better performance
    const queryTexts = lineItems
      .map(item => item.parsed_data?.name || item.raw_text)
      .filter(text => text && typeof text === 'string' && text.trim().length > 0)
    
    const { data: batchResults, error } = await supabaseAdmin
      .rpc('hybrid_product_match_batch', {
        query_texts: queryTexts,
        limit_count: 1, // Only get best match for bulk generation
        threshold
      })
    
    if (error) {
      console.error('🚨 Batch matching function failed, falling back to sequential:', error)
      throw error
    }
    
    // Group results by query index
    const resultsByIndex = new Map<number, any[]>()
    batchResults?.forEach((result: any) => {
      const index = result.query_index - 1 // Convert from 1-based to 0-based
      if (!resultsByIndex.has(index)) {
        resultsByIndex.set(index, [])
      }
      resultsByIndex.get(index)?.push(result)
    })
    
    // Prepare batch inserts with best matches
    const matchInserts: any[] = []
    
    lineItems.forEach((lineItem, index) => {
      const candidates = resultsByIndex.get(index) || []
      if (candidates.length > 0) {
        const bestCandidate = candidates[0]
        
        if (bestCandidate.final_score >= threshold) {
          matchInserts.push({
            line_item_id: lineItem.id,
            product_id: bestCandidate.product_id,
            organization_id: organizationId,
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
          
          results.push({
            lineItemId: lineItem.id,
            lineItemText: queryTexts[index],
            matchedProduct: bestCandidate.name,
            score: bestCandidate.final_score,
            matchedVia: bestCandidate.matched_via
          })
        }
      }
    })
    
    // Single batch insert for all matches
    if (matchInserts.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('matches')
        .insert(matchInserts)
      
      if (insertError) {
        console.error('🚨 Batch insert failed:', insertError)
        throw insertError
      }
      
      generatedCount = matchInserts.length
    }
    
    const endTime = performance.now()
    const executionTime = Math.round(endTime - startTime)
    
    console.log(`🚀 Ultra-optimized batch generation completed in ${executionTime}ms: ${generatedCount} matches generated`)
    
    return { success: true, generatedCount, results }
    
  } catch (error) {
    console.error('🚨 Batch optimization failed, falling back to sequential processing:', error)
    
    // Fallback to sequential processing with smaller batches
    const FALLBACK_BATCH_SIZE = 20
    
    for (let i = 0; i < lineItems.length; i += FALLBACK_BATCH_SIZE) {
      const batch = lineItems.slice(i, i + FALLBACK_BATCH_SIZE)
      
      // Process batch in parallel
      const candidatePromises = batch.map(async (lineItem) => {
        const matchText = lineItem.parsed_data?.name || lineItem.raw_text
        
        try {
          const { data: candidates, error } = await supabaseAdmin.rpc('hybrid_product_match_tiered', {
            query_text: matchText,
            limit_count: 1,
            threshold
          })
          
          if (error || !candidates || candidates.length === 0) {
            return null
          }
          
          return { lineItem, candidates, matchText }
        } catch (err) {
          console.error(`🚨 Failed to generate match for item ${lineItem.id}:`, err)
          return null
        }
      })
      
      const batchResults = await Promise.allSettled(candidatePromises)
      
      // Prepare batch inserts for this chunk
      const matchInserts: any[] = []
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          const { lineItem, candidates, matchText } = result.value
          const bestCandidate = candidates[0]
          
          if (bestCandidate.final_score >= threshold) {
            matchInserts.push({
              line_item_id: lineItem.id,
              product_id: bestCandidate.product_id,
              organization_id: organizationId,
              status: 'pending',
              confidence_score: bestCandidate.final_score,
              vector_score: bestCandidate.vector_score,
              trigram_score: bestCandidate.trigram_score,
              fuzzy_score: bestCandidate.fuzzy_score,
              alias_score: bestCandidate.alias_score,
              final_score: bestCandidate.final_score,
              matched_text: bestCandidate.name,
              reasoning: `Auto-generated via ${bestCandidate.matched_via}`
            })
            
            results.push({
              lineItemId: lineItem.id,
              lineItemText: matchText,
              matchedProduct: bestCandidate.name,
              score: bestCandidate.final_score,
              matchedVia: bestCandidate.matched_via
            })
          }
        }
      })
      
      // Insert matches for this batch
      if (matchInserts.length > 0) {
        try {
          const { error: insertError } = await supabaseAdmin
            .from('matches')
            .insert(matchInserts)
          
          if (!insertError) {
            generatedCount += matchInserts.length
          }
        } catch (insertError) {
          console.error('🚨 Insert error for batch:', insertError)
        }
      }
      
      // Small delay between batches
      if (i + FALLBACK_BATCH_SIZE < lineItems.length) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
    
    return { success: true, generatedCount, results }
  }
}

// Optimized bulk match operations
export async function bulkUpdateMatches(
  matchUpdates: Array<{
    lineItemId: string
    status: 'approved' | 'rejected' | 'pending'
    productId?: string
    userId: string
    candidateData?: MatchCandidate
  }>,
  organizationId: string
): Promise<{ success: boolean; updatedCount: number }> {
  if (matchUpdates.length === 0) {
    return { success: true, updatedCount: 0 }
  }

  // Prepare batch updates
  const matchUpserts = matchUpdates.map(update => ({
    line_item_id: update.lineItemId,
    product_id: update.productId || null,
    organization_id: organizationId,
    status: update.status,
    confidence_score: update.candidateData?.final_score || null,
    vector_score: update.candidateData?.vector_score || null,
    trigram_score: update.candidateData?.trigram_score || null,
    fuzzy_score: update.candidateData?.fuzzy_score || null,
    alias_score: update.candidateData?.alias_score || null,
    final_score: update.candidateData?.final_score || null,
    matched_text: update.candidateData?.name || null,
    reasoning: update.candidateData ? `Matched via ${update.candidateData.matched_via}` : 'Bulk operation',
    reviewed_by: update.userId,
    reviewed_at: new Date().toISOString()
  }))

  // Execute batch upsert
  const { error, count } = await supabaseAdmin
    .from('matches')
    .upsert(matchUpserts, { onConflict: 'line_item_id' })

  if (error) {
    throw error
  }

  // Clear relevant cache entries
  queryCache.clear()

  return { success: true, updatedCount: count || 0 }
}

// 🚀 Ultra-optimized candidate generation with batch processing and advanced caching
export async function getMatchCandidatesBatch(
  lineItems: LineItem[],
  threshold: number = 0.2
): Promise<Record<string, MatchCandidate[]>> {
  if (lineItems.length === 0) {
    return {}
  }

  console.log(`🚀 Starting optimized candidate generation for ${lineItems.length} items`)
  const startTime = performance.now()
  
  const candidateCache = new Map<string, MatchCandidate[]>()
  const uncachedItems: LineItem[] = []
  
  // Check cache first with performance tracking
  let cacheHits = 0
  lineItems.forEach(item => {
    const cacheKey = `candidates_v2_${item.id}_${threshold}`
    const cached = queryCache.get<MatchCandidate[]>(cacheKey)
    if (cached) {
      candidateCache.set(item.id, cached)
      cacheHits++
    } else {
      uncachedItems.push(item)
    }
  })
  
  console.log(`📋 Cache hits: ${cacheHits}/${lineItems.length}, processing ${uncachedItems.length} uncached items`)

  // Process uncached items using optimized batch function
  if (uncachedItems.length > 0) {
    try {
      // 🎯 Use batch hybrid matching function for maximum efficiency
      const queryTexts = uncachedItems
        .map(item => item.parsed_data?.name || item.raw_text)
        .filter(text => text && typeof text === 'string' && text.trim().length > 0)
      
      const { data: batchResults, error } = await supabase
        .rpc('hybrid_product_match_batch', {
          query_texts: queryTexts,
          limit_count: 5,
          threshold
        })
      
      if (error) {
        console.error('🚨 Batch candidate function failed, falling back to sequential:', error)
        throw error
      }
      
      // Group results by query index and map to item IDs
      const resultsByIndex = new Map<number, MatchCandidate[]>()
      batchResults?.forEach((result: any) => {
        const index = result.query_index - 1 // Convert from 1-based to 0-based
        if (!resultsByIndex.has(index)) {
          resultsByIndex.set(index, [])
        }
        resultsByIndex.get(index)?.push({
          product_id: result.product_id,
          sku: result.sku,
          name: result.name,
          manufacturer: result.manufacturer,
          category: result.category,
          vector_score: result.vector_score,
          trigram_score: result.trigram_score,
          fuzzy_score: result.fuzzy_score,
          alias_score: result.alias_score,
          final_score: result.final_score,
          matched_via: result.matched_via,
          reasoning: result.reasoning
        })
      })
      
      // Cache all results
      uncachedItems.forEach((item, index) => {
        const candidates = resultsByIndex.get(index) || []
        const cacheKey = `candidates_v2_${item.id}_${threshold}`
        
        // Cache for 5 minutes
        queryCache.set(cacheKey, candidates, 5 * 60 * 1000)
        candidateCache.set(item.id, candidates)
      })
      
    } catch (error) {
      console.error('🚨 Batch optimization failed, using fallback parallel processing:', error)
      
      // Fallback to parallel processing with smaller batches
      const FALLBACK_BATCH_SIZE = 10
      const batchPromises: Promise<any>[] = []
      
      for (let i = 0; i < uncachedItems.length; i += FALLBACK_BATCH_SIZE) {
        const batch = uncachedItems.slice(i, i + FALLBACK_BATCH_SIZE)
        
        const batchPromise = Promise.all(
          batch.map(async (item) => {
            const matchText = item.parsed_data?.name || item.raw_text
            
            // Skip items with invalid text data
            if (!matchText || typeof matchText !== 'string' || matchText.trim().length === 0) {
              console.warn(`⚠️ Skipping item ${item.id}: no valid text data for matching`)
              return { itemId: item.id, candidates: [] }
            }
            
            try {
              const { data: candidates, error } = await supabase.rpc('hybrid_product_match_tiered', {
                query_text: matchText.trim(),
                limit_count: 5,
                threshold
              })
              
              if (error) {
                console.error(`🚨 Match error for item ${item.id}:`, error)
                return { itemId: item.id, candidates: [] }
              }
              
              const validCandidates = candidates || []
              
              // Cache the results
              const cacheKey = `candidates_v2_${item.id}_${threshold}`
              queryCache.set(cacheKey, validCandidates, 5 * 60 * 1000)
              
              return { itemId: item.id, candidates: validCandidates }
            } catch (error) {
              console.error(`🚨 Error generating candidates for item ${item.id}:`, error)
              return { itemId: item.id, candidates: [] }
            }
          })
        )
        
        batchPromises.push(batchPromise)
        
        // Small delay between batches to avoid rate limiting
        if (i + FALLBACK_BATCH_SIZE < uncachedItems.length) {
          await new Promise(resolve => setTimeout(resolve, 25))
        }
      }
      
      // Wait for all batches to complete
      const batchResults = await Promise.all(batchPromises)
      
      // Aggregate results
      batchResults.forEach(batchResult => {
        batchResult.forEach(({ itemId, candidates }: { itemId: string; candidates: MatchCandidate[] }) => {
          candidateCache.set(itemId, candidates)
        })
      })
    }
  }

  // Convert Map to plain object
  const result: Record<string, MatchCandidate[]> = {}
  candidateCache.forEach((candidates, itemId) => {
    result[itemId] = candidates
  })
  
  const endTime = performance.now()
  const executionTime = Math.round(endTime - startTime)
  const totalCandidates = Object.values(result).reduce((sum, candidates) => sum + candidates.length, 0)
  
  console.log(`🚀 Candidate generation completed in ${executionTime}ms: ${totalCandidates} candidates for ${lineItems.length} items (${cacheHits} cache hits)`)
  
  return result
}

// 🚀 Ultra-optimized statistics using database function
export async function getMatchStatistics(organizationId: string): Promise<{
  totalItems: number
  pending: number
  approved: number
  rejected: number
  avgConfidence?: number
}> {
  const cacheKey = `stats_optimized_${organizationId}`
  const cached = queryCache.get<any>(cacheKey)
  
  if (cached) {
    console.log('📊 Statistics cache hit')
    return cached
  }

  const startTime = performance.now()
  
  try {
    // 🎯 Use optimized database function for single-query statistics
    const { data, error } = await supabase
      .rpc('get_match_statistics_optimized', {
        p_organization_id: organizationId
      })

    if (error) {
      console.error('🚨 Optimized statistics function failed:', error)
      throw error
    }

    if (!data || data.length === 0) {
      const emptyStats = {
        totalItems: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        avgConfidence: 0
      }
      queryCache.set(cacheKey, emptyStats, 1 * 60 * 1000)
      return emptyStats
    }

    const result = data[0]
    const stats = {
      totalItems: parseInt(result.total_items) || 0,
      pending: parseInt(result.pending_items) || 0,
      approved: parseInt(result.approved_items) || 0,
      rejected: parseInt(result.rejected_items) || 0,
      avgConfidence: result.avg_confidence ? parseFloat(result.avg_confidence) : undefined
    }

    // Cache for 3 minutes
    queryCache.set(cacheKey, stats, 3 * 60 * 1000)
    
    const endTime = performance.now()
    const executionTime = Math.round(endTime - startTime)
    
    console.log(`📊 Optimized statistics completed in ${executionTime}ms`)
    
    return stats
    
  } catch (error) {
    console.error('🚨 Falling back to aggregation query:', error)
    
    // Fallback to client-side aggregation
    const { data, error: fallbackError } = await supabase
      .from('line_items')
      .select(`
        id,
        matches!left (
          status,
          final_score
        )
      `)
      .eq('organization_id', organizationId)

    if (fallbackError) throw fallbackError

    const stats = {
      totalItems: data?.length || 0,
      pending: 0,
      approved: 0,
      rejected: 0
    }
    
    const confidenceScores: number[] = []

    data?.forEach(item => {
      const match = item.matches?.[0]
      if (!match || match.status === 'pending') {
        stats.pending++
      } else if (match.status === 'approved' || match.status === 'auto_matched') {
        stats.approved++
        if (match.final_score) {
          confidenceScores.push(parseFloat(match.final_score.toString()))
        }
      } else if (match.status === 'rejected') {
        stats.rejected++
      }
    })
    
    const avgConfidence = confidenceScores.length > 0 
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
      : undefined

    const finalStats = { ...stats, avgConfidence }
    queryCache.set(cacheKey, finalStats, 2 * 60 * 1000) // Cache fallback for 2 minutes
    return finalStats
  }
}

// Clear cache helper
export function clearQueryCache(): void {
  queryCache.clear()
}

// Background cache warming for better performance
export async function warmCache(organizationId: string): Promise<void> {
  try {
    // Warm up line items cache
    await getLineItemsWithMatches(organizationId, { limit: 50 })
    
    // Warm up statistics cache
    await getMatchStatistics(organizationId)
    
    console.log('🔥 Cache warmed up successfully')
  } catch (error) {
    console.error('⚠️ Cache warming failed:', error)
  }
}