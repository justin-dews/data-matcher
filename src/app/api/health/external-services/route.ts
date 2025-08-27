/**
 * Health Check API for External Services
 * 
 * Provides comprehensive health monitoring for all external API dependencies:
 * - LlamaParse API (PDF processing)
 * - OpenAI API (embeddings)
 * - Circuit breaker status
 * - Service metrics and performance data
 * 
 * This endpoint allows for proactive monitoring and alerting when services
 * experience issues, enabling graceful degradation strategies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resilientApiClient, checkAllServicesHealth, SERVICE_CONFIGS } from '@/lib/api-resilience';

export interface ServiceHealthStatus {
  name: string;
  healthy: boolean;
  responseTime: number;
  error?: string;
  circuitBreakerState?: string;
  lastRequestTime?: number;
  successRate?: number;
}

export interface SystemHealthResponse {
  timestamp: string;
  overall: {
    healthy: boolean;
    score: number; // 0-100 health score
  };
  services: ServiceHealthStatus[];
  circuitBreakers: Array<{
    serviceName: string;
    state: string;
    failures: number;
    successes: number;
    lastFailureTime: number;
  }>;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
  };
}

async function performIndividualHealthChecks(): Promise<ServiceHealthStatus[]> {
  const healthChecks = [
    {
      name: 'LlamaParse',
      endpoint: 'https://api.cloud.llamaindex.ai/api/health',
      timeout: 5000
    },
    {
      name: 'OpenAI',
      endpoint: 'https://api.openai.com/v1/models',
      timeout: 5000,
      requiresAuth: true
    }
  ];

  const results: ServiceHealthStatus[] = [];

  for (const check of healthChecks) {
    const startTime = Date.now();
    
    try {
      const headers: Record<string, string> = {};
      
      // Add authentication if required
      if (check.requiresAuth && check.name === 'OpenAI') {
        const openAIKey = process.env.OPENAI_API_KEY;
        if (openAIKey) {
          headers['Authorization'] = `Bearer ${openAIKey}`;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), check.timeout);

      const response = await fetch(check.endpoint, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      results.push({
        name: check.name,
        healthy: response.ok,
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      results.push({
        name: check.name,
        healthy: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}

function calculateHealthScore(services: ServiceHealthStatus[]): number {
  if (services.length === 0) return 0;

  const healthyServices = services.filter(s => s.healthy).length;
  const baseScore = (healthyServices / services.length) * 100;

  // Apply penalties for slow response times
  const avgResponseTime = services.reduce((sum, s) => sum + s.responseTime, 0) / services.length;
  const responsePenalty = Math.min(avgResponseTime / 1000 * 5, 25); // Max 25 point penalty for slow responses

  return Math.max(0, Math.round(baseScore - responsePenalty));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('Performing external services health check...');
    const startTime = Date.now();

    // Perform individual health checks
    const serviceStatuses = await performIndividualHealthChecks();

    // Get circuit breaker statistics
    const circuitBreakerStats = resilientApiClient.getCircuitBreakerStats();

    // Get service metrics
    const metrics = resilientApiClient.getServiceMetrics();
    const aggregatedMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };

    let totalResponseTime = 0;
    let serviceCount = 0;

    for (const [serviceName, serviceMetrics] of metrics) {
      aggregatedMetrics.totalRequests += serviceMetrics.totalRequests;
      aggregatedMetrics.successfulRequests += serviceMetrics.successfulRequests;
      aggregatedMetrics.failedRequests += serviceMetrics.failedRequests;
      totalResponseTime += serviceMetrics.averageResponseTime;
      serviceCount++;
    }

    if (serviceCount > 0) {
      aggregatedMetrics.averageResponseTime = totalResponseTime / serviceCount;
    }

    // Enhance service statuses with circuit breaker and metrics data
    const enhancedStatuses = serviceStatuses.map(status => {
      const circuitBreaker = circuitBreakerStats.find(cb => 
        cb.serviceName.toLowerCase().includes(status.name.toLowerCase())
      );
      
      const serviceMetrics = Array.from(metrics.entries()).find(([name]) => 
        name.toLowerCase().includes(status.name.toLowerCase())
      );

      const enhanced = { ...status };

      if (circuitBreaker) {
        enhanced.circuitBreakerState = circuitBreaker.state;
      }

      if (serviceMetrics) {
        const [, metrics] = serviceMetrics;
        enhanced.lastRequestTime = metrics.lastRequestTime;
        enhanced.successRate = metrics.totalRequests > 0 
          ? Math.round((metrics.successfulRequests / metrics.totalRequests) * 100) 
          : undefined;
      }

      return enhanced;
    });

    // Calculate overall health
    const healthScore = calculateHealthScore(enhancedStatuses);
    const overallHealthy = enhancedStatuses.every(s => s.healthy) && healthScore >= 80;

    const healthResponse: SystemHealthResponse = {
      timestamp: new Date().toISOString(),
      overall: {
        healthy: overallHealthy,
        score: healthScore
      },
      services: enhancedStatuses,
      circuitBreakers: circuitBreakerStats,
      metrics: aggregatedMetrics
    };

    const responseTime = Date.now() - startTime;
    console.log(`Health check completed in ${responseTime}ms. Overall healthy: ${overallHealthy}, Score: ${healthScore}`);

    return NextResponse.json(healthResponse, {
      status: overallHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        'X-Health-Check-Duration': responseTime.toString()
      }
    });

  } catch (error) {
    console.error('Health check failed:', error);

    const errorResponse: SystemHealthResponse = {
      timestamp: new Date().toISOString(),
      overall: {
        healthy: false,
        score: 0
      },
      services: [{
        name: 'Health Check System',
        healthy: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }],
      circuitBreakers: [],
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0
      }
    };

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0'
      }
    });
  }
}

// Additional endpoint for detailed service metrics
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { action } = await request.json();

    if (action === 'reset-circuit-breakers') {
      const { serviceName } = await request.json();
      
      if (serviceName) {
        resilientApiClient.resetCircuitBreaker(serviceName);
        return NextResponse.json({ 
          success: true, 
          message: `Circuit breaker for ${serviceName} has been reset` 
        });
      } else {
        // Reset all circuit breakers
        const stats = resilientApiClient.getCircuitBreakerStats();
        stats.forEach(stat => {
          resilientApiClient.resetCircuitBreaker(stat.serviceName);
        });
        
        return NextResponse.json({ 
          success: true, 
          message: 'All circuit breakers have been reset' 
        });
      }
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Invalid action' 
    }, { status: 400 });

  } catch (error) {
    console.error('Health check action failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}