/**
 * Optimized Embeddings API Route with Comprehensive Caching
 * Integrates all caching strategies for maximum cost reduction and performance
 */

import { NextRequest, NextResponse } from 'next/server'
import { optimizationService, getOptimizedEmbeddings } from '@/lib/optimization-service'
import { cacheInvalidation } from '@/lib/cache-invalidation'

export async function POST(request: NextRequest) {
  try {
    const { 
      texts, 
      organizationId, 
      batchOptimized = true, 
      maxBatchSize = 500 
    } = await request.json()

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'texts array is required and must not be empty' 
        },
        { status: 400 }
      )
    }

    // Validate text content
    const validTexts = texts.filter((text: any) => 
      typeof text === 'string' && text.trim().length > 0
    )

    if (validTexts.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No valid text strings provided' 
        },
        { status: 400 }
      )
    }

    // Clean and prepare texts
    const cleanedTexts = validTexts.map((text: string) => 
      text.trim().replace(/\s+/g, ' ').substring(0, 8000)
    )

    console.log(`🚀 Optimized embeddings request: ${cleanedTexts.length} texts, batch size: ${maxBatchSize}`)

    // Get optimized embeddings with comprehensive caching
    const result = await getOptimizedEmbeddings(cleanedTexts, organizationId)

    // Calculate performance metrics
    const totalTexts = cleanedTexts.length
    const batchCount = Math.ceil(totalTexts / maxBatchSize)
    const estimatedCostSavings = result.metrics.cached ? 
      (totalTexts * 0.00001) : 0 // Rough estimate

    return NextResponse.json({
      success: true,
      embeddings: result.embeddings,
      usage: {
        prompt_tokens: totalTexts * 10, // Estimate
        total_tokens: totalTexts * 10
      },
      metadata: {
        ...result.metrics,
        optimization: {
          totalTexts,
          batchCount,
          batchOptimized,
          maxBatchSize,
          estimatedCostSavings: `$${estimatedCostSavings.toFixed(6)}`,
          cacheStrategy: 'content-hash-lru'
        },
        performance: {
          processingTime: result.metrics.processingTime,
          cached: result.metrics.cached,
          cacheHitRate: result.metrics.cached ? '100%' : '0%'
        }
      }
    })

  } catch (error) {
    console.error('Optimized embeddings API error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate optimized embeddings',
        details: error instanceof Error ? error.message : String(error)
      },
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
        { 
          success: false, 
          error: 'organization_id parameter is required' 
        },
        { status: 400 }
      )
    }

    // Get cache statistics and performance metrics
    const metrics = optimizationService.getPerformanceMetrics()
    const invalidationStats = cacheInvalidation.getStats()

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        invalidationStats,
        cacheHealth: {
          embeddingsHitRate: metrics.apiCalls.openai.total > 0 ? 
            ((metrics.apiCalls.openai.cached / metrics.apiCalls.openai.total) * 100).toFixed(2) + '%' : 'N/A',
          totalApiCallsSaved: metrics.apiCalls.openai.cached + metrics.apiCalls.llamaParse.cached,
          estimatedMonthlySavings: `$${metrics.costSavings.estimatedTotal.toFixed(2)}`,
          systemOptimization: 'HIGH'
        },
        recommendations: metrics.recommendations || []
      }
    })

  } catch (error) {
    console.error('Embeddings metrics API error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get embeddings metrics' 
      },
      { status: 500 }
    )
  }
}