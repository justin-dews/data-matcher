/**
 * Comprehensive caching service for PathoptMatch
 * Implements high-performance LRU cache with TTL support for expensive operations
 * Targets 40-60% cost reduction and major performance improvements
 */

import { createHash } from 'crypto'

// Cache configuration constants
const CACHE_CONFIG = {
  // OpenAI Embeddings - Long TTL since text embeddings don't change
  EMBEDDINGS: {
    TTL: 7 * 24 * 60 * 60 * 1000, // 7 days
    MAX_SIZE: 10000, // 10K embeddings
  },
  
  // LlamaParse Results - Medium TTL since documents don't change often
  LLAMAPARSE: {
    TTL: 24 * 60 * 60 * 1000, // 24 hours
    MAX_SIZE: 1000, // 1K documents
  },
  
  // Match Results - Short TTL since product catalog can change
  MATCH_RESULTS: {
    TTL: 4 * 60 * 60 * 1000, // 4 hours
    MAX_SIZE: 50000, // 50K match results
  },
  
  // Database Queries - Very short TTL for freshness
  DB_QUERIES: {
    TTL: 15 * 60 * 1000, // 15 minutes
    MAX_SIZE: 5000, // 5K query results
  },
} as const

interface CacheEntry<T> {
  value: T
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private maxSize: number
  private hits = 0
  private misses = 0

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  /**
   * Generate content hash for cache key
   */
  private generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16)
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  /**
   * Evict least recently used entries if cache is full
   */
  private evictIfNeeded(): void {
    if (this.cache.size <= this.maxSize) return

    // Sort by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)

    // Remove oldest 25% of entries
    const toRemove = Math.ceil(this.maxSize * 0.25)
    for (let i = 0; i < toRemove && entries.length > 0; i++) {
      const [key] = entries[i]
      this.cache.delete(key)
    }
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry || this.isExpired(entry)) {
      if (entry) {
        this.cache.delete(key) // Clean up expired entry
      }
      this.misses++
      return null
    }

    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = Date.now()
    this.hits++

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)
    
    return entry.value
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl: number): void {
    // Remove existing entry if it exists
    this.cache.delete(key)

    // Create new entry
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccessed: Date.now(),
    }

    this.cache.set(key, entry)
    this.evictIfNeeded()
  }

  /**
   * Generate cache key from content hash
   */
  generateKey(content: string, prefix?: string): string {
    const hash = this.generateHash(content)
    return prefix ? `${prefix}:${hash}` : hash
  }

  /**
   * Clear expired entries
   */
  clearExpired(): number {
    const expired: string[] = []
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expired.push(key)
      }
    }
    
    expired.forEach(key => this.cache.delete(key))
    return expired.length
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.hits + this.misses
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? (this.hits / totalRequests * 100).toFixed(2) : '0',
      totalRequests,
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }
}

/**
 * Global cache instances for different operation types
 */
class CacheService {
  private embeddingsCache = new LRUCache<number[][]>(CACHE_CONFIG.EMBEDDINGS.MAX_SIZE)
  private llamaParseCache = new LRUCache<any>(CACHE_CONFIG.LLAMAPARSE.MAX_SIZE)
  private matchResultsCache = new LRUCache<any>(CACHE_CONFIG.MATCH_RESULTS.MAX_SIZE)
  private dbQueryCache = new LRUCache<any>(CACHE_CONFIG.DB_QUERIES.MAX_SIZE)

  /**
   * OpenAI Embeddings Cache
   */
  async getEmbeddings(texts: string[]): Promise<number[][] | null> {
    const key = this.embeddingsCache.generateKey(JSON.stringify(texts), 'embed')
    return this.embeddingsCache.get(key)
  }

  async setEmbeddings(texts: string[], embeddings: number[][]): Promise<void> {
    const key = this.embeddingsCache.generateKey(JSON.stringify(texts), 'embed')
    this.embeddingsCache.set(key, embeddings, CACHE_CONFIG.EMBEDDINGS.TTL)
  }

  /**
   * LlamaParse Results Cache
   */
  async getLlamaParseResult(fileHash: string): Promise<any | null> {
    const key = `llamaparse:${fileHash}`
    return this.llamaParseCache.get(key)
  }

  async setLlamaParseResult(fileHash: string, result: any): Promise<void> {
    const key = `llamaparse:${fileHash}`
    this.llamaParseCache.set(key, result, CACHE_CONFIG.LLAMAPARSE.TTL)
  }

  /**
   * Match Results Cache
   */
  async getMatchResults(queryHash: string): Promise<any | null> {
    const key = `matches:${queryHash}`
    return this.matchResultsCache.get(key)
  }

  async setMatchResults(queryHash: string, results: any): Promise<void> {
    const key = `matches:${queryHash}`
    this.matchResultsCache.set(key, results, CACHE_CONFIG.MATCH_RESULTS.TTL)
  }

  /**
   * Database Query Cache
   */
  async getDbQuery(query: string, params?: any): Promise<any | null> {
    const key = this.dbQueryCache.generateKey(
      JSON.stringify({ query, params }), 
      'db'
    )
    return this.dbQueryCache.get(key)
  }

  async setDbQuery(query: string, params: any, result: any): Promise<void> {
    const key = this.dbQueryCache.generateKey(
      JSON.stringify({ query, params }), 
      'db'
    )
    this.dbQueryCache.set(key, result, CACHE_CONFIG.DB_QUERIES.TTL)
  }

  /**
   * Generate file hash from buffer/blob
   */
  generateFileHash(buffer: ArrayBuffer | Uint8Array): string {
    const hash = createHash('sha256')
    hash.update(new Uint8Array(buffer))
    return hash.digest('hex').slice(0, 32)
  }

  /**
   * Generate query hash for match caching
   */
  generateMatchQueryHash(lineItemText: string, organizationId: string): string {
    return createHash('sha256')
      .update(`${lineItemText}:${organizationId}`)
      .digest('hex')
      .slice(0, 24)
  }

  /**
   * Maintenance: Clear expired entries across all caches
   */
  clearExpired(): { [key: string]: number } {
    return {
      embeddings: this.embeddingsCache.clearExpired(),
      llamaParse: this.llamaParseCache.clearExpired(),
      matchResults: this.matchResultsCache.clearExpired(),
      dbQueries: this.dbQueryCache.clearExpired(),
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats() {
    return {
      embeddings: this.embeddingsCache.getStats(),
      llamaParse: this.llamaParseCache.getStats(),
      matchResults: this.matchResultsCache.getStats(),
      dbQueries: this.dbQueryCache.getStats(),
    }
  }

  /**
   * Clear all caches (for testing/debugging)
   */
  clearAll(): void {
    this.embeddingsCache.clear()
    this.llamaParseCache.clear()
    this.matchResultsCache.clear()
    this.dbQueryCache.clear()
  }
}

// Global singleton instance
export const cacheService = new CacheService()

/**
 * Cache-aware batch processing utility
 */
export class BatchProcessor {
  /**
   * Process texts in optimized batches with caching
   * Returns { cached: T[], uncached: string[] }
   */
  static async processBatchWithCache<T>(
    texts: string[],
    getCached: (text: string) => Promise<T | null>,
    processBatch: (uncachedTexts: string[]) => Promise<T[]>,
    setCached: (text: string, result: T) => Promise<void>
  ): Promise<T[]> {
    const results: T[] = []
    const uncachedTexts: string[] = []
    const uncachedIndices: number[] = []

    // Check cache for each text
    for (let i = 0; i < texts.length; i++) {
      const cached = await getCached(texts[i])
      if (cached !== null) {
        results[i] = cached
      } else {
        uncachedTexts.push(texts[i])
        uncachedIndices.push(i)
      }
    }

    // Process uncached texts if any
    if (uncachedTexts.length > 0) {
      const processedResults = await processBatch(uncachedTexts)
      
      // Store results in cache and final array
      for (let i = 0; i < processedResults.length; i++) {
        const originalIndex = uncachedIndices[i]
        const result = processedResults[i]
        results[originalIndex] = result
        await setCached(uncachedTexts[i], result)
      }
    }

    return results
  }
}

/**
 * Performance monitoring wrapper
 */
export function withCacheMetrics<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operationName: string
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now()
    const result = await fn(...args)
    const endTime = Date.now()
    
    console.log(`[CACHE-METRICS] ${operationName}: ${endTime - startTime}ms`)
    return result
  }
}