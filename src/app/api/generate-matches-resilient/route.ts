/**
 * Resilient AI Matching Pipeline
 * 
 * This enhanced matching API provides comprehensive resilience patterns for
 * the AI-powered product matching system, including:
 * 
 * - Fallback to cached embeddings when OpenAI API is unavailable
 * - Alternative matching algorithms when AI services fail
 * - Graceful degradation with progressively simpler matching strategies
 * - Circuit breaker patterns to prevent cascade failures
 * - Comprehensive error handling and user-friendly messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { EmbeddingsFallback, MatchingFallback, GracefulDegradation } from '@/lib/fallback-strategies';
import { resilientApiClient } from '@/lib/api-resilience';

interface MatchingRequest {
  organizationId: string;
  userId: string;
  lineItemIds?: string[]; // Optional: match specific line items only
  confidenceThreshold?: number; // Optional: minimum confidence threshold
}

interface MatchingResponse {
  success: boolean;
  data?: {
    generatedCount: number;
    totalProcessed: number;
    matches: any[];
    metadata: {
      algorithm: string;
      source: 'primary' | 'cache' | 'fallback' | 'offline';
      degraded: boolean;
      message: string;
      processingTime: number;
      circuitBreakerStatus?: Record<string, string>;
    };
  };
  error?: string;
}

async function getUnmatchedLineItems(
  organizationId: string,
  lineItemIds?: string[]
): Promise<any[]> {
  let query = supabaseAdmin
    .from('line_items')
    .select(`
      id,
      raw_text,
      parsed_data,
      quantity,
      unit_price,
      total_price,
      company_name,
      line_number
    `)
    .eq('organization_id', organizationId);

  if (lineItemIds && lineItemIds.length > 0) {
    query = query.in('id', lineItemIds);
  } else {
    // Only get items that don't have matches yet
    const { data: existingMatches } = await supabaseAdmin
      .from('matches')
      .select('line_item_id')
      .eq('organization_id', organizationId);

    const existingMatchLineItemIds = new Set((existingMatches || []).map((m: any) => m.line_item_id));
    
    const { data: allLineItems } = await query;
    const unmatchedItems = (allLineItems || []).filter((item: any) => !existingMatchLineItemIds.has(item.id));
    
    return unmatchedItems;
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch line items: ${error.message}`);
  }

  return data || [];
}

async function getProductCatalog(organizationId: string): Promise<any[]> {
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select(`
      id,
      sku,
      name,
      manufacturer,
      description,
      category,
      unit_price,
      created_at
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch product catalog: ${error.message}`);
  }

  return products || [];
}

async function generateEmbeddingsWithResilience(
  texts: string[],
  productIds?: string[]
): Promise<{ 
  success: boolean; 
  embeddings?: number[][]; 
  source: string; 
  degraded: boolean; 
  message: string 
}> {
  console.log(`Generating embeddings for ${texts.length} texts with resilience patterns`);

  try {
    // Use the resilient embeddings generation
    const result = await EmbeddingsFallback.generateWithFallback(texts, productIds);
    
    return {
      success: result.success,
      embeddings: result.data?.embeddings,
      source: result.source,
      degraded: result.degraded || false,
      message: result.message || 'Embeddings generated successfully'
    };

  } catch (error) {
    console.error('All embedding generation methods failed:', error);
    
    return {
      success: false,
      embeddings: [],
      source: 'offline',
      degraded: true,
      message: 'Embedding generation failed. Vector similarity matching is disabled.'
    };
  }
}

async function performTieredMatching(
  lineItems: any[],
  products: any[],
  organizationId: string,
  confidenceThreshold: number = 0.2,
  embeddingsAvailable: boolean = true
): Promise<{
  matches: any[];
  algorithm: string;
  degraded: boolean;
  message: string;
}> {
  console.log(`Performing tiered matching for ${lineItems.length} line items against ${products.length} products`);

  try {
    if (embeddingsAvailable) {
      // Try the full hybrid tiered matching system
      console.log('Using full hybrid tiered matching system');
      
      const { data: matches, error } = await supabaseAdmin
        .rpc('hybrid_product_match_tiered', {
          p_line_items: lineItems.map(item => ({
            id: item.id,
            raw_text: item.raw_text || '',
            organization_id: organizationId
          })),
          p_organization_id: organizationId,
          p_confidence_threshold: confidenceThreshold
        });

      if (error) {
        console.error('Hybrid matching failed:', error);
        throw new Error(`Hybrid matching failed: ${error.message}`);
      }

      return {
        matches: matches || [],
        algorithm: 'hybrid_tiered_with_embeddings',
        degraded: false,
        message: `Generated ${matches?.length || 0} matches using full AI-powered tiered matching`
      };

    } else {
      // Fall back to basic matching without embeddings
      console.log('Using basic matching without embeddings');
      
      const fallbackResult = await MatchingFallback.matchWithFallback(lineItems, organizationId);
      
      return {
        matches: fallbackResult.data || [],
        algorithm: 'string_similarity_fallback',
        degraded: true,
        message: fallbackResult.message || 'Using basic string matching due to AI service unavailability'
      };
    }

  } catch (error) {
    console.error('All matching algorithms failed:', error);
    
    // Final fallback to manual matching suggestions
    return {
      matches: [],
      algorithm: 'manual_review_required',
      degraded: true,
      message: 'Automatic matching is currently unavailable. Manual product matching required.'
    };
  }
}

async function storeMatches(
  matches: any[],
  organizationId: string,
  userId: string,
  metadata: any
): Promise<any[]> {
  if (matches.length === 0) {
    return [];
  }

  const matchesToInsert = matches.map(match => ({
    line_item_id: match.line_item_id,
    product_id: match.product_id,
    confidence_score: match.confidence_score,
    reasoning: match.reasoning,
    match_source: match.match_source || metadata.algorithm,
    status: 'pending',
    organization_id: organizationId,
    created_by: userId,
    metadata: {
      algorithm: metadata.algorithm,
      degraded: metadata.degraded,
      processing_source: metadata.source
    }
  }));

  const { data: insertedMatches, error: insertError } = await supabaseAdmin
    .from('matches')
    .insert(matchesToInsert)
    .select();

  if (insertError) {
    throw new Error(`Failed to store matches: ${insertError.message}`);
  }

  return insertedMatches || [];
}

async function logMatchingAttempt(
  organizationId: string,
  userId: string,
  result: {
    success: boolean;
    totalProcessed: number;
    generatedCount: number;
    algorithm: string;
    degraded: boolean;
    processingTime: number;
  }
): Promise<void> {
  try {
    await supabaseAdmin
      .from('matching_attempts')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        total_processed: result.totalProcessed,
        matches_generated: result.generatedCount,
        algorithm_used: result.algorithm,
        success: result.success,
        degraded: result.degraded,
        processing_time_ms: result.processingTime,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Failed to log matching attempt:', error);
    // Don't throw - logging failures shouldn't break the main flow
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<MatchingResponse>> {
  const startTime = Date.now();

  try {
    console.log('Starting resilient AI matching pipeline...');
    
    const body: MatchingRequest = await request.json();
    const { organizationId, userId, lineItemIds, confidenceThreshold = 0.2 } = body;

    if (!organizationId || !userId) {
      return NextResponse.json<MatchingResponse>({
        success: false,
        error: 'Missing required fields: organizationId or userId'
      }, { status: 400 });
    }

    // Step 1: Get unmatched line items
    console.log('Step 1: Fetching unmatched line items...');
    const lineItems = await getUnmatchedLineItems(organizationId, lineItemIds);
    
    if (lineItems.length === 0) {
      return NextResponse.json<MatchingResponse>({
        success: true,
        data: {
          generatedCount: 0,
          totalProcessed: 0,
          matches: [],
          metadata: {
            algorithm: 'none_required',
            source: 'primary',
            degraded: false,
            message: 'No unmatched line items found',
            processingTime: Date.now() - startTime
          }
        }
      });
    }

    console.log(`Found ${lineItems.length} unmatched line items`);

    // Step 2: Get product catalog
    console.log('Step 2: Fetching product catalog...');
    const products = await getProductCatalog(organizationId);
    
    if (products.length === 0) {
      return NextResponse.json<MatchingResponse>({
        success: false,
        error: 'No products found in catalog. Please add products before matching.'
      }, { status: 400 });
    }

    console.log(`Found ${products.length} products in catalog`);

    // Step 3: Generate embeddings with resilience (if needed for vector similarity)
    console.log('Step 3: Generating embeddings with resilience patterns...');
    const texts = [
      ...lineItems.map(item => item.raw_text || ''),
      ...products.map(product => `${product.name} ${product.description || ''}`.trim())
    ];

    const embeddingResult = await generateEmbeddingsWithResilience(texts);
    const embeddingsAvailable = embeddingResult.success && (embeddingResult.embeddings?.length || 0) > 0;
    
    console.log(`Embeddings available: ${embeddingsAvailable} (source: ${embeddingResult.source})`);

    // Step 4: Perform tiered matching with resilience
    console.log('Step 4: Performing tiered matching...');
    const matchingResult = await performTieredMatching(
      lineItems,
      products,
      organizationId,
      confidenceThreshold,
      embeddingsAvailable
    );

    // Step 5: Store successful matches
    console.log('Step 5: Storing matches...');
    const storedMatches = await storeMatches(
      matchingResult.matches,
      organizationId,
      userId,
      {
        algorithm: matchingResult.algorithm,
        degraded: matchingResult.degraded,
        source: embeddingResult.source
      }
    );

    const processingTime = Date.now() - startTime;
    const isDegraded = embeddingResult.degraded || matchingResult.degraded;

    // Step 6: Log the matching attempt for monitoring
    await logMatchingAttempt(organizationId, userId, {
      success: true,
      totalProcessed: lineItems.length,
      generatedCount: storedMatches.length,
      algorithm: matchingResult.algorithm,
      degraded: isDegraded,
      processingTime
    });

    // Get circuit breaker status for debugging
    const circuitBreakerStats = resilientApiClient.getCircuitBreakerStats();
    const circuitBreakerStatus: Record<string, string> = {};
    circuitBreakerStats.forEach(stat => {
      circuitBreakerStatus[stat.serviceName] = stat.state;
    });

    console.log(`Resilient matching completed in ${processingTime}ms: ${storedMatches.length}/${lineItems.length} matches`);

    const response: MatchingResponse = {
      success: true,
      data: {
        generatedCount: storedMatches.length,
        totalProcessed: lineItems.length,
        matches: storedMatches,
        metadata: {
          algorithm: matchingResult.algorithm,
          source: embeddingResult.source,
          degraded: isDegraded,
          message: isDegraded 
            ? `Matching completed with degraded functionality: ${matchingResult.message}`
            : matchingResult.message,
          processingTime,
          circuitBreakerStatus
        }
      }
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-Processing-Time': processingTime.toString(),
        'X-Service-Status': isDegraded ? 'degraded' : 'operational',
        'X-Algorithm-Used': matchingResult.algorithm,
        'X-Embeddings-Source': embeddingResult.source
      }
    });

  } catch (error) {
    console.error('Resilient matching pipeline failed:', error);

    const processingTime = Date.now() - startTime;
    
    // Log the failed attempt
    try {
      const body: MatchingRequest = await request.json();
      await logMatchingAttempt(body.organizationId, body.userId, {
        success: false,
        totalProcessed: 0,
        generatedCount: 0,
        algorithm: 'failed',
        degraded: true,
        processingTime
      });
    } catch (logError) {
      console.error('Failed to log failed attempt:', logError);
    }

    // Use graceful degradation for complete failure scenarios
    const degradationResult = await GracefulDegradation.handleServiceFailure(
      'AI Matching',
      'product matching'
    );

    return NextResponse.json<MatchingResponse>({
      success: false,
      error: degradationResult.message || (error instanceof Error ? error.message : 'Matching process failed')
    }, { 
      status: 500,
      headers: {
        'X-Processing-Time': processingTime.toString(),
        'X-Service-Status': 'failed'
      }
    });
  }
}

// Health check endpoint for the matching service
export async function GET(): Promise<NextResponse> {
  try {
    const healthChecks = await Promise.allSettled([
      // Check database connection
      supabaseAdmin.from('line_items').select('id').limit(1),
      
      // Check if the hybrid matching function exists
      supabaseAdmin.rpc('hybrid_product_match_tiered', {
        p_line_items: [],
        p_organization_id: '00000000-0000-0000-0000-000000000000',
        p_confidence_threshold: 0.2
      }).then(() => true).catch(() => false),
    ]);

    const circuitBreakerStats = resilientApiClient.getCircuitBreakerStats();
    const apiServicesHealthy = circuitBreakerStats.every(stat => stat.state === 'CLOSED');

    return NextResponse.json({
      service: 'generate-matches-resilient',
      healthy: healthChecks[0].status === 'fulfilled',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: healthChecks[0].status === 'fulfilled',
        matching_function: healthChecks[1].status === 'fulfilled',
        api_services: apiServicesHealthy
      },
      circuit_breakers: circuitBreakerStats
    }, {
      status: healthChecks[0].status === 'fulfilled' ? 200 : 503
    });

  } catch (error) {
    return NextResponse.json({
      service: 'generate-matches-resilient',
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }
}