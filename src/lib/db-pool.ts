import { supabase, supabaseAdmin } from './supabase'

// Database connection pool management
class DatabasePool {
  private activeConnections = new Map<string, number>()
  private connectionQueue: Array<() => void> = []
  private maxConcurrentConnections = 10

  async acquireConnection(operationType: string): Promise<void> {
    const currentConnections = Array.from(this.activeConnections.values())
      .reduce((sum, count) => sum + count, 0)

    if (currentConnections >= this.maxConcurrentConnections) {
      // Wait for a connection to be available
      await new Promise<void>((resolve) => {
        this.connectionQueue.push(resolve)
      })
    }

    // Track this connection
    const current = this.activeConnections.get(operationType) || 0
    this.activeConnections.set(operationType, current + 1)
  }

  releaseConnection(operationType: string): void {
    const current = this.activeConnections.get(operationType) || 0
    this.activeConnections.set(operationType, Math.max(0, current - 1))

    // Release next queued connection
    if (this.connectionQueue.length > 0) {
      const nextResolve = this.connectionQueue.shift()
      if (nextResolve) {
        nextResolve()
      }
    }
  }

  getStats(): { active: number; queued: number; byType: Record<string, number> } {
    const totalActive = Array.from(this.activeConnections.values())
      .reduce((sum, count) => sum + count, 0)
    
    const byType: Record<string, number> = {}
    this.activeConnections.forEach((count, type) => {
      byType[type] = count
    })

    return {
      active: totalActive,
      queued: this.connectionQueue.length,
      byType
    }
  }
}

export const dbPool = new DatabasePool()

// Wrapper function for database operations with connection pooling
export async function withDatabaseConnection<T>(
  operationType: string,
  operation: () => Promise<T>
): Promise<T> {
  await dbPool.acquireConnection(operationType)
  
  try {
    const result = await operation()
    return result
  } finally {
    dbPool.releaseConnection(operationType)
  }
}

// Optimized query wrapper that includes performance tracking
export async function executeQuery<T>(
  queryName: string,
  query: () => Promise<T>,
  organizationId?: string
): Promise<T> {
  const startTime = Date.now()
  
  try {
    const result = await withDatabaseConnection(queryName, query)
    const executionTime = Date.now() - startTime
    
    // Log performance if it takes too long
    if (executionTime > 1000) {
      console.warn(`⚠️ Slow query detected: ${queryName} took ${executionTime}ms`)
    }
    
    // Track performance in database (optional, for monitoring)
    if (organizationId && executionTime > 500) {
      // Only track slower queries to avoid overhead
      supabaseAdmin
        .from('query_performance_stats')
        .insert({
          query_name: queryName,
          organization_id: organizationId,
          execution_time_ms: executionTime,
          row_count: Array.isArray(result) ? result.length : 1,
          cache_hit: false
        })
        .then(() => {}) // Fire and forget
        .catch(() => {}) // Ignore errors
    }
    
    return result
  } catch (error) {
    const executionTime = Date.now() - startTime
    console.error(`❌ Query failed: ${queryName} after ${executionTime}ms`, error)
    throw error
  }
}

// Batch operation helper
export async function executeBatchOperation<T>(
  operationName: string,
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<any>
): Promise<any[]> {
  const results: any[] = []
  
  console.log(`📦 Starting batch operation: ${operationName} for ${items.length} items (batch size: ${batchSize})`)
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchNumber = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(items.length / batchSize)
    
    console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`)
    
    try {
      const batchResult = await withDatabaseConnection(
        `${operationName}_batch_${batchNumber}`,
        () => processor(batch)
      )
      results.push(batchResult)
      
      // Small delay between batches to prevent overwhelming the database
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    } catch (error) {
      console.error(`❌ Batch ${batchNumber} failed:`, error)
      throw error
    }
  }
  
  console.log(`✅ Batch operation completed: ${operationName}`)
  return results
}

// Connection health check
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean
  responseTime: number
  poolStats: any
}> {
  const startTime = Date.now()
  
  try {
    await supabase.from('organizations').select('id').limit(1)
    const responseTime = Date.now() - startTime
    
    return {
      healthy: true,
      responseTime,
      poolStats: dbPool.getStats()
    }
  } catch (error) {
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      poolStats: dbPool.getStats()
    }
  }
}