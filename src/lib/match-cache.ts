/**
 * Match Result Caching System
 * Caches expensive hybrid matching computations for major performance improvements
 * Implements intelligent cache invalidation based on product catalog changes
 */

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

interface MatchResult {
  line_item_id: string
  product_id: string | null
  confidence_score: number
  reasoning: string
  match_source: string
  tier_used: number
}

interface CachedMatch {
  results: MatchResult[]
  timestamp: number
  ttl: number
  queryHash: string
  organizationId: string
  accessCount: number
}

interface MatchQuery {
  lineItemText: string
  organizationId: string
  threshold: number
  productCatalogVersion?: string
}

/**
 * High-performance match result cache with intelligent invalidation
 */
class MatchResultCache {
  private cache = new Map<string, CachedMatch>()
  private readonly TTL = 4 * 60 * 60 * 1000 // 4 hours
  private readonly MAX_ENTRIES = 50000
  
  // Track product catalog versions for cache invalidation
  private catalogVersions = new Map<string, string>()
  
  private hits = 0
  private misses = 0

  /**
   * Generate match query hash for caching key
   */
  generateQueryHash(query: MatchQuery): string {
    const content = JSON.stringify({
      text: query.lineItemText.toLowerCase().trim(),
      orgId: query.organizationId,
      threshold: query.threshold,
      catalogVersion: query.productCatalogVersion
    })
    
    return createHash('sha256')
      .update(content)
      .digest('hex')
      .slice(0, 24)
  }

  /**
   * Get cached match results
   */
  async getMatches(query: MatchQuery): Promise<MatchResult[] | null> {
    const queryHash = this.generateQueryHash(query)
    const entry = this.cache.get(queryHash)
    
    if (!entry || this.isExpired(entry)) {
      if (entry) {
        this.cache.delete(queryHash)
      }
      this.misses++
      return null
    }

    // Check if product catalog has been updated since cache entry
    const currentCatalogVersion = await this.getProductCatalogVersion(query.organizationId)
    if (query.productCatalogVersion && query.productCatalogVersion !== currentCatalogVersion) {
      this.cache.delete(queryHash)
      this.misses++
      return null
    }

    entry.accessCount++
    this.hits++
    return entry.results
  }

  /**
   * Cache match results
   */
  async setMatches(query: MatchQuery, results: MatchResult[]): Promise<void> {
    const queryHash = this.generateQueryHash(query)
    
    const entry: CachedMatch = {
      results,
      timestamp: Date.now(),
      ttl: this.TTL,
      queryHash,
      organizationId: query.organizationId,
      accessCount: 1
    }

    this.cache.set(queryHash, entry)
    this.evictIfNeeded()
  }

  /**
   * Get product catalog version for cache invalidation
   */
  private async getProductCatalogVersion(organizationId: string): Promise<string> {
    // Check memory cache first
    const cached = this.catalogVersions.get(organizationId)
    if (cached) return cached

    try {
      // Get last updated timestamp from products table
      const { data, error } = await supabaseAdmin
        .from('products')
        .select('updated_at')
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false })
        .limit(1)

      if (error || !data || data.length === 0) {
        return 'unknown'
      }

      const version = createHash('md5')
        .update(data[0].updated_at)
        .digest('hex')
        .slice(0, 12)
      
      // Cache for 5 minutes
      this.catalogVersions.set(organizationId, version)
      setTimeout(() => this.catalogVersions.delete(organizationId), 5 * 60 * 1000)
      
      return version
    } catch (error) {
      console.error('Error getting catalog version:', error)
      return 'error'
    }
  }

  /**
   * Invalidate cache for specific organization
   */
  async invalidateOrganization(organizationId: string): Promise<number> {
    let removed = 0
    
    for (const [hash, entry] of this.cache.entries()) {
      if (entry.organizationId === organizationId) {
        this.cache.delete(hash)
        removed++
      }
    }
    
    // Clear catalog version cache
    this.catalogVersions.delete(organizationId)
    
    console.log(`Invalidated ${removed} cache entries for organization ${organizationId}`)
    return removed
  }

  /**
   * Smart cache invalidation based on product changes
   */
  async invalidateProduct(productId: string, organizationId: string): Promise<number> {
    let removed = 0
    
    // Remove entries that might be affected by this product change
    for (const [hash, entry] of this.cache.entries()) {
      if (entry.organizationId === organizationId) {
        // Check if any result references this product
        const affectedByProduct = entry.results.some(result => result.product_id === productId)
        if (affectedByProduct) {
          this.cache.delete(hash)
          removed++
        }
      }
    }
    
    // Update catalog version to invalidate remaining cache
    this.catalogVersions.delete(organizationId)
    
    console.log(`Invalidated ${removed} cache entries affected by product ${productId}`)
    return removed
  }

  private isExpired(entry: CachedMatch): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private evictIfNeeded(): void {
    if (this.cache.size <= this.MAX_ENTRIES) return

    // Evict least recently used entries
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => {
        const scoreA = a.accessCount / (Date.now() - a.timestamp + 1)
        const scoreB = b.accessCount / (Date.now() - b.timestamp + 1)
        return scoreA - scoreB
      })

    const toRemove = Math.ceil(this.MAX_ENTRIES * 0.1)
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0])
    }
  }

  /**
   * Clear expired entries
   */
  clearExpired(): number {
    const expired: string[] = []
    
    for (const [hash, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expired.push(hash)
      }
    }
    
    expired.forEach(hash => this.cache.delete(hash))
    return expired.length
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.hits + this.misses
    return {
      size: this.cache.size,
      maxSize: this.MAX_ENTRIES,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? ((this.hits / totalRequests) * 100).toFixed(2) : '0',
      totalRequests,
      catalogVersionsCached: this.catalogVersions.size
    }
  }

  clear(): void {
    this.cache.clear()
    this.catalogVersions.clear()
    this.hits = 0
    this.misses = 0
  }
}

// Global instance
export const matchCache = new MatchResultCache()

/**
 * Cached hybrid matching function
 */
export async function getCachedMatches(
  lineItemText: string,
  organizationId: string,
  threshold: number = 0.2
): Promise<MatchResult[]> {
  const catalogVersion = await matchCache['getProductCatalogVersion'](organizationId)
  
  const query: MatchQuery = {
    lineItemText,
    organizationId,
    threshold,
    productCatalogVersion: catalogVersion
  }

  // Check cache first
  const cached = await matchCache.getMatches(query)
  if (cached) {
    console.log(`🎯 MATCH CACHE HIT for: "${lineItemText.slice(0, 50)}..."`)
    return cached
  }

  console.log(`Cache miss, calling hybrid matching for: "${lineItemText.slice(0, 50)}..."`)

  // Call actual hybrid matching function
  const { data: results, error } = await supabaseAdmin
    .rpc('hybrid_product_match_tiered', {
      search_text: lineItemText,
      org_id: organizationId,
      similarity_threshold: threshold
    })

  if (error) {
    console.error('Hybrid matching error:', error)
    return []
  }

  const matchResults: MatchResult[] = (results || []).map((result: any) => ({
    line_item_id: '', // Will be set by caller
    product_id: result.product_id,
    confidence_score: result.confidence_score,
    reasoning: result.reasoning,
    match_source: result.match_source,
    tier_used: result.tier_used || 3
  }))

  // Cache the results
  await matchCache.setMatches(query, matchResults)

  return matchResults
}

/**
 * Batch processing with match caching
 */
export async function batchGetCachedMatches(
  lineItems: Array<{ id: string, text: string }>,
  organizationId: string,
  threshold: number = 0.2
): Promise<Map<string, MatchResult[]>> {
  const results = new Map<string, MatchResult[]>()
  const uncachedItems: Array<{ id: string, text: string }> = []
  
  // Check cache for each item
  const catalogVersion = await matchCache['getProductCatalogVersion'](organizationId)
  
  for (const item of lineItems) {
    const query: MatchQuery = {
      lineItemText: item.text,
      organizationId,
      threshold,
      productCatalogVersion: catalogVersion
    }

    const cached = await matchCache.getMatches(query)
    if (cached) {
      results.set(item.id, cached.map(result => ({
        ...result,
        line_item_id: item.id
      })))
    } else {
      uncachedItems.push(item)
    }
  }

  console.log(`Batch cache check: ${results.size}/${lineItems.length} cached, ${uncachedItems.length} need processing`)

  // Process uncached items in batches
  if (uncachedItems.length > 0) {
    const batchSize = 10 // Process in smaller batches to avoid timeouts
    
    for (let i = 0; i < uncachedItems.length; i += batchSize) {
      const batch = uncachedItems.slice(i, i + batchSize)
      
      for (const item of batch) {
        const matchResults = await getCachedMatches(item.text, organizationId, threshold)
        results.set(item.id, matchResults.map(result => ({
          ...result,
          line_item_id: item.id
        })))
      }
    }
  }

  return results
}

/**
 * Cache maintenance functions
 */
export async function performMatchCacheMaintenance() {
  const stats = {
    expiredCleared: matchCache.clearExpired(),
    cacheStats: matchCache.getStats()
  }
  
  console.log('Match cache maintenance completed:', stats)
  return stats
}