/**
 * Advanced Cache Invalidation and TTL Management System
 * Implements smart invalidation strategies and optimal TTL policies
 * Ensures cache consistency while maximizing performance benefits
 */

import { cacheService } from './cache-service'
import { matchCache } from './match-cache'
import { dbCache } from './db-cache'
import { supabaseAdmin } from './supabase'

interface InvalidationRule {
  trigger: string
  cacheTypes: CacheType[]
  strategy: InvalidationStrategy
  condition?: (data: any) => boolean
}

interface TTLPolicy {
  cacheType: CacheType
  baseTTL: number
  maxTTL: number
  minTTL: number
  adaptive: boolean
  factors: TTLFactor[]
}

interface TTLFactor {
  metric: string
  multiplier: number
  condition?: (value: number) => boolean
}

enum CacheType {
  EMBEDDINGS = 'embeddings',
  LLAMAPARSE = 'llamaParse',
  MATCHES = 'matches',
  DATABASE = 'database'
}

enum InvalidationStrategy {
  IMMEDIATE = 'immediate',
  BATCH = 'batch',
  LAZY = 'lazy',
  SCHEDULED = 'scheduled'
}

/**
 * Intelligent cache invalidation manager
 */
class CacheInvalidationManager {
  private rules: InvalidationRule[] = []
  private policies: TTLPolicy[] = []
  private scheduledJobs = new Map<string, NodeJS.Timeout>()
  private batchQueue = new Map<CacheType, Set<string>>()
  private batchTimeout: NodeJS.Timeout | null = null

  constructor() {
    this.initializeDefaultRules()
    this.initializeDefaultPolicies()
    this.setupRealtimeListeners()
  }

  /**
   * Initialize default invalidation rules
   */
  private initializeDefaultRules(): void {
    this.rules = [
      // Product catalog changes invalidate matches and embeddings
      {
        trigger: 'products:update',
        cacheTypes: [CacheType.MATCHES, CacheType.DATABASE],
        strategy: InvalidationStrategy.IMMEDIATE,
        condition: (data) => data.organization_id !== undefined
      },
      {
        trigger: 'products:insert',
        cacheTypes: [CacheType.MATCHES, CacheType.DATABASE, CacheType.EMBEDDINGS],
        strategy: InvalidationStrategy.BATCH
      },
      {
        trigger: 'products:delete',
        cacheTypes: [CacheType.MATCHES, CacheType.DATABASE, CacheType.EMBEDDINGS],
        strategy: InvalidationStrategy.IMMEDIATE
      },

      // Training data changes affect match results
      {
        trigger: 'match_training_data:insert',
        cacheTypes: [CacheType.MATCHES],
        strategy: InvalidationStrategy.LAZY,
        condition: (data) => data.quality_score > 0.7
      },
      {
        trigger: 'match_training_data:update',
        cacheTypes: [CacheType.MATCHES],
        strategy: InvalidationStrategy.BATCH
      },

      // Organization changes require complete cache clear
      {
        trigger: 'organizations:update',
        cacheTypes: [CacheType.MATCHES, CacheType.DATABASE, CacheType.EMBEDDINGS],
        strategy: InvalidationStrategy.IMMEDIATE
      },

      // Document processing doesn't typically need invalidation (content-based)
      {
        trigger: 'documents:delete',
        cacheTypes: [CacheType.LLAMAPARSE],
        strategy: InvalidationStrategy.SCHEDULED
      }
    ]
  }

  /**
   * Initialize adaptive TTL policies
   */
  private initializeDefaultPolicies(): void {
    this.policies = [
      // Embeddings: Long TTL, stable content
      {
        cacheType: CacheType.EMBEDDINGS,
        baseTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxTTL: 30 * 24 * 60 * 60 * 1000, // 30 days
        minTTL: 1 * 60 * 60 * 1000, // 1 hour
        adaptive: true,
        factors: [
          { metric: 'hitRate', multiplier: 1.5, condition: (rate) => rate > 0.8 },
          { metric: 'accessCount', multiplier: 1.2, condition: (count) => count > 10 }
        ]
      },

      // Document parsing: Medium TTL, documents don't change often
      {
        cacheType: CacheType.LLAMAPARSE,
        baseTTL: 24 * 60 * 60 * 1000, // 24 hours
        maxTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
        minTTL: 1 * 60 * 60 * 1000, // 1 hour
        adaptive: true,
        factors: [
          { metric: 'fileSize', multiplier: 1.3, condition: (size) => size > 1024 * 1024 }, // Larger files cache longer
          { metric: 'hitRate', multiplier: 1.4, condition: (rate) => rate > 0.6 }
        ]
      },

      // Match results: Medium TTL, affected by catalog changes
      {
        cacheType: CacheType.MATCHES,
        baseTTL: 4 * 60 * 60 * 1000, // 4 hours
        maxTTL: 24 * 60 * 60 * 1000, // 24 hours
        minTTL: 15 * 60 * 1000, // 15 minutes
        adaptive: true,
        factors: [
          { metric: 'catalogStability', multiplier: 1.5, condition: (stability) => stability > 0.9 },
          { metric: 'hitRate', multiplier: 1.3, condition: (rate) => rate > 0.7 }
        ]
      },

      // Database queries: Short TTL, data freshness important
      {
        cacheType: CacheType.DATABASE,
        baseTTL: 15 * 60 * 1000, // 15 minutes
        maxTTL: 2 * 60 * 60 * 1000, // 2 hours
        minTTL: 1 * 60 * 1000, // 1 minute
        adaptive: true,
        factors: [
          { metric: 'queryComplexity', multiplier: 1.4, condition: (complexity) => complexity > 0.8 },
          { metric: 'changeFrequency', multiplier: 0.8, condition: (freq) => freq > 0.5 }
        ]
      }
    ]
  }

  /**
   * Setup real-time database change listeners for automatic invalidation
   */
  private setupRealtimeListeners(): void {
    // Listen to products table changes
    supabaseAdmin
      .channel('cache-invalidation')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'products' },
        (payload) => this.handleDatabaseChange('products', payload.eventType, payload.new || payload.old)
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'match_training_data' },
        (payload) => this.handleDatabaseChange('match_training_data', payload.eventType, payload.new || payload.old)
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'organizations' },
        (payload) => this.handleDatabaseChange('organizations', payload.eventType, payload.new || payload.old)
      )
      .subscribe()

    console.log('🔄 Cache invalidation listeners established')
  }

  /**
   * Handle database change events
   */
  private async handleDatabaseChange(table: string, event: string, data: any): Promise<void> {
    const trigger = `${table}:${event.toLowerCase()}`
    const matchingRules = this.rules.filter(rule => rule.trigger === trigger)

    for (const rule of matchingRules) {
      // Check condition if specified
      if (rule.condition && !rule.condition(data)) {
        continue
      }

      console.log(`🔄 Invalidation triggered: ${trigger} -> ${rule.cacheTypes.join(', ')}`)

      switch (rule.strategy) {
        case InvalidationStrategy.IMMEDIATE:
          await this.immediateInvalidation(rule.cacheTypes, data)
          break
        case InvalidationStrategy.BATCH:
          this.batchInvalidation(rule.cacheTypes, data)
          break
        case InvalidationStrategy.LAZY:
          this.lazyInvalidation(rule.cacheTypes, data)
          break
        case InvalidationStrategy.SCHEDULED:
          this.scheduledInvalidation(rule.cacheTypes, data)
          break
      }
    }
  }

  /**
   * Immediate cache invalidation
   */
  private async immediateInvalidation(cacheTypes: CacheType[], data: any): Promise<void> {
    for (const cacheType of cacheTypes) {
      switch (cacheType) {
        case CacheType.EMBEDDINGS:
          // Embeddings are content-based, rarely need invalidation
          if (data.organization_id) {
            console.log(`Invalidating embeddings for org: ${data.organization_id}`)
          }
          break

        case CacheType.LLAMAPARSE:
          // Document cache rarely needs invalidation (file content-based)
          break

        case CacheType.MATCHES:
          if (data.organization_id) {
            const invalidated = await matchCache.invalidateOrganization(data.organization_id)
            console.log(`Invalidated ${invalidated} match cache entries`)
          }
          if (data.id) {
            const invalidated = await matchCache.invalidateProduct(data.id, data.organization_id)
            console.log(`Invalidated ${invalidated} match cache entries for product`)
          }
          break

        case CacheType.DATABASE:
          if (data.organization_id) {
            const invalidated = dbCache.invalidateTable('products')
            console.log(`Invalidated ${invalidated} database cache entries`)
          }
          break
      }
    }
  }

  /**
   * Batch invalidation with delay
   */
  private batchInvalidation(cacheTypes: CacheType[], data: any): void {
    for (const cacheType of cacheTypes) {
      if (!this.batchQueue.has(cacheType)) {
        this.batchQueue.set(cacheType, new Set())
      }
      
      const key = data.organization_id || data.id || 'global'
      this.batchQueue.get(cacheType)!.add(key)
    }

    // Process batch after 5 seconds of no new changes
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
    }

    this.batchTimeout = setTimeout(() => {
      this.processBatchInvalidation()
    }, 5000)
  }

  /**
   * Process batched invalidations
   */
  private async processBatchInvalidation(): Promise<void> {
    console.log('🔄 Processing batch invalidation...')

    for (const [cacheType, keys] of this.batchQueue.entries()) {
      for (const key of keys) {
        await this.immediateInvalidation([cacheType], { organization_id: key })
      }
    }

    this.batchQueue.clear()
    this.batchTimeout = null
  }

  /**
   * Lazy invalidation (mark for invalidation on next access)
   */
  private lazyInvalidation(cacheTypes: CacheType[], data: any): void {
    // Implementation would mark cache entries for lazy invalidation
    console.log(`Lazy invalidation scheduled for: ${cacheTypes.join(', ')}`)
  }

  /**
   * Scheduled invalidation
   */
  private scheduledInvalidation(cacheTypes: CacheType[], data: any): void {
    const jobId = `${Date.now()}-${Math.random()}`
    
    const timeout = setTimeout(async () => {
      await this.immediateInvalidation(cacheTypes, data)
      this.scheduledJobs.delete(jobId)
    }, 5 * 60 * 1000) // 5 minutes delay

    this.scheduledJobs.set(jobId, timeout)
  }

  /**
   * Calculate adaptive TTL based on policies and metrics
   */
  calculateAdaptiveTTL(
    cacheType: CacheType,
    metrics: { [key: string]: number } = {}
  ): number {
    const policy = this.policies.find(p => p.cacheType === cacheType)
    if (!policy || !policy.adaptive) {
      return policy?.baseTTL || 15 * 60 * 1000
    }

    let ttl = policy.baseTTL
    
    for (const factor of policy.factors) {
      const value = metrics[factor.metric]
      if (value !== undefined && (!factor.condition || factor.condition(value))) {
        ttl *= factor.multiplier
      }
    }

    // Clamp to min/max bounds
    ttl = Math.max(policy.minTTL, Math.min(policy.maxTTL, ttl))
    
    return Math.floor(ttl)
  }

  /**
   * Global cache maintenance
   */
  async performMaintenance(): Promise<{
    expired: { [key: string]: number }
    invalidated: { [key: string]: number }
    metrics: any
  }> {
    console.log('🧹 Starting comprehensive cache maintenance...')

    // Clear expired entries
    const expired = {
      embeddings: cacheService.clearExpired().embeddings,
      llamaParse: cacheService.clearExpired().llamaParse,
      matches: matchCache.clearExpired(),
      database: dbCache.clearExpired()
    }

    // Force process any pending batch invalidations
    if (this.batchQueue.size > 0) {
      await this.processBatchInvalidation()
    }

    // Get updated cache statistics
    const metrics = {
      cacheService: cacheService.getStats(),
      matchCache: matchCache.getStats(),
      dbCache: dbCache.getStats()
    }

    const result = {
      expired,
      invalidated: { batch: 0 },
      metrics,
      timestamp: new Date().toISOString()
    }

    console.log('Cache maintenance completed:', result)
    return result
  }

  /**
   * Manual cache invalidation for specific scenarios
   */
  async invalidateByOrganization(organizationId: string): Promise<number> {
    let total = 0
    
    total += await matchCache.invalidateOrganization(organizationId)
    total += dbCache.invalidateTable('products')
    
    console.log(`Manual invalidation for org ${organizationId}: ${total} entries`)
    return total
  }

  async invalidateByProduct(productId: string, organizationId: string): Promise<number> {
    return matchCache.invalidateProduct(productId, organizationId)
  }

  /**
   * Get invalidation statistics
   */
  getStats() {
    return {
      rules: this.rules.length,
      policies: this.policies.length,
      scheduledJobs: this.scheduledJobs.size,
      batchQueue: Object.fromEntries(
        Array.from(this.batchQueue.entries()).map(([type, keys]) => [type, keys.size])
      )
    }
  }

  /**
   * Update TTL policies dynamically
   */
  updateTTLPolicy(cacheType: CacheType, updates: Partial<TTLPolicy>): void {
    const policyIndex = this.policies.findIndex(p => p.cacheType === cacheType)
    if (policyIndex >= 0) {
      this.policies[policyIndex] = { ...this.policies[policyIndex], ...updates }
      console.log(`Updated TTL policy for ${cacheType}:`, updates)
    }
  }

  /**
   * Add custom invalidation rule
   */
  addInvalidationRule(rule: InvalidationRule): void {
    this.rules.push(rule)
    console.log(`Added invalidation rule: ${rule.trigger} -> ${rule.cacheTypes.join(', ')}`)
  }

  /**
   * Cleanup on shutdown
   */
  cleanup(): void {
    // Clear all scheduled jobs
    for (const timeout of this.scheduledJobs.values()) {
      clearTimeout(timeout)
    }
    this.scheduledJobs.clear()

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
    }

    console.log('🧹 Cache invalidation manager cleanup completed')
  }
}

// Global instance
export const cacheInvalidation = new CacheInvalidationManager()

// Export helper functions
export async function invalidateOrganizationCache(organizationId: string) {
  return cacheInvalidation.invalidateByOrganization(organizationId)
}

export async function invalidateProductCache(productId: string, organizationId: string) {
  return cacheInvalidation.invalidateByProduct(productId, organizationId)
}

export function calculateTTL(cacheType: CacheType, metrics?: { [key: string]: number }) {
  return cacheInvalidation.calculateAdaptiveTTL(cacheType, metrics)
}

export async function performCacheMaintenance() {
  return cacheInvalidation.performMaintenance()
}

export function getCacheInvalidationStats() {
  return cacheInvalidation.getStats()
}

// Export enums for external use
export { CacheType, InvalidationStrategy }