/**
 * Comprehensive API Resilience Library for PathoptMatch
 * 
 * Provides retry logic, circuit breaker patterns, rate limit handling,
 * and health checking for external API integrations.
 * 
 * Key Features:
 * - Exponential backoff with jitter
 * - Circuit breaker pattern to prevent cascade failures
 * - Rate limit detection and handling (429 responses)
 * - Request timeouts and error classification
 * - Health check endpoints
 * - Fallback strategies for graceful degradation
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
  jitterFactor: number;
  timeoutMs: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitoringWindowMs: number;
}

export interface APIServiceConfig {
  name: string;
  baseUrl: string;
  retry: RetryConfig;
  circuitBreaker: CircuitBreakerConfig;
  rateLimitConfig: {
    maxRequestsPerMinute: number;
    rateLimitHeaderName: string;
    retryAfterHeaderName: string;
  };
}

export enum ErrorType {
  NETWORK = 'NETWORK',
  RATE_LIMIT = 'RATE_LIMIT', 
  TIMEOUT = 'TIMEOUT',
  SERVER_ERROR = 'SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  AUTHENTICATION = 'AUTHENTICATION',
  PERMANENT = 'PERMANENT'
}

export interface APIError extends Error {
  type: ErrorType;
  statusCode?: number;
  retryAfter?: number;
  isRetryable: boolean;
  originalError?: Error;
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN', 
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerStats {
  failures: number;
  successes: number;
  lastFailureTime: number;
  state: CircuitBreakerState;
  nextAttemptTime: number;
}

interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime: number;
}

class CircuitBreaker {
  private stats: CircuitBreakerStats;
  private config: CircuitBreakerConfig;
  private serviceName: string;

  constructor(serviceName: string, config: CircuitBreakerConfig) {
    this.serviceName = serviceName;
    this.config = config;
    this.stats = {
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      state: CircuitBreakerState.CLOSED,
      nextAttemptTime: 0
    };
  }

  canExecute(): boolean {
    const now = Date.now();

    switch (this.stats.state) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        if (now >= this.stats.nextAttemptTime) {
          this.stats.state = CircuitBreakerState.HALF_OPEN;
          console.log(`Circuit breaker [${this.serviceName}]: Transitioning to HALF_OPEN`);
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        return true;

      default:
        return true;
    }
  }

  onSuccess(): void {
    this.stats.successes++;
    
    if (this.stats.state === CircuitBreakerState.HALF_OPEN) {
      this.stats.state = CircuitBreakerState.CLOSED;
      this.stats.failures = 0;
      console.log(`Circuit breaker [${this.serviceName}]: Transitioning to CLOSED`);
    }
  }

  onFailure(): void {
    this.stats.failures++;
    this.stats.lastFailureTime = Date.now();

    if (this.stats.state === CircuitBreakerState.HALF_OPEN) {
      this.openCircuit();
    } else if (this.stats.failures >= this.config.failureThreshold) {
      this.openCircuit();
    }
  }

  private openCircuit(): void {
    this.stats.state = CircuitBreakerState.OPEN;
    this.stats.nextAttemptTime = Date.now() + this.config.resetTimeoutMs;
    console.log(`Circuit breaker [${this.serviceName}]: Transitioning to OPEN for ${this.config.resetTimeoutMs}ms`);
  }

  getStats(): CircuitBreakerStats & { serviceName: string } {
    return { ...this.stats, serviceName: this.serviceName };
  }
}

export class ResilientAPIClient {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private metrics: Map<string, RequestMetrics> = new Map();
  private rateLimiters: Map<string, { requests: number[]; windowStart: number }> = new Map();

  private static instance: ResilientAPIClient;

  static getInstance(): ResilientAPIClient {
    if (!ResilientAPIClient.instance) {
      ResilientAPIClient.instance = new ResilientAPIClient();
    }
    return ResilientAPIClient.instance;
  }

  private getCircuitBreaker(serviceName: string, config: CircuitBreakerConfig): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker(serviceName, config));
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  private updateMetrics(serviceName: string, success: boolean, responseTime: number): void {
    const current = this.metrics.get(serviceName) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastRequestTime: 0
    };

    current.totalRequests++;
    current.lastRequestTime = Date.now();

    if (success) {
      current.successfulRequests++;
    } else {
      current.failedRequests++;
    }

    // Calculate rolling average response time
    current.averageResponseTime = (current.averageResponseTime * (current.totalRequests - 1) + responseTime) / current.totalRequests;

    this.metrics.set(serviceName, current);
  }

  private checkRateLimit(serviceName: string, config: APIServiceConfig): boolean {
    const rateLimiter = this.rateLimiters.get(serviceName) || { requests: [], windowStart: Date.now() };
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    // Clean old requests outside the window
    rateLimiter.requests = rateLimiter.requests.filter(timestamp => now - timestamp < windowMs);

    // Check if we're at the limit
    if (rateLimiter.requests.length >= config.rateLimitConfig.maxRequestsPerMinute) {
      return false;
    }

    // Add current request
    rateLimiter.requests.push(now);
    this.rateLimiters.set(serviceName, rateLimiter);
    return true;
  }

  private classifyError(error: any, response?: Response): APIError {
    const apiError = error as APIError;
    apiError.isRetryable = false;
    apiError.originalError = error;

    if (response) {
      apiError.statusCode = response.status;

      // Rate limiting
      if (response.status === 429) {
        apiError.type = ErrorType.RATE_LIMIT;
        apiError.isRetryable = true;
        const retryAfter = response.headers.get('Retry-After') || response.headers.get('retry-after');
        if (retryAfter) {
          apiError.retryAfter = parseInt(retryAfter) * 1000; // Convert to ms
        }
        return apiError;
      }

      // Server errors (5xx) are typically retryable
      if (response.status >= 500) {
        apiError.type = ErrorType.SERVER_ERROR;
        apiError.isRetryable = true;
        return apiError;
      }

      // Authentication errors
      if (response.status === 401 || response.status === 403) {
        apiError.type = ErrorType.AUTHENTICATION;
        apiError.isRetryable = false;
        return apiError;
      }

      // Client errors (4xx except rate limiting and auth) are not retryable
      if (response.status >= 400) {
        apiError.type = ErrorType.CLIENT_ERROR;
        apiError.isRetryable = false;
        return apiError;
      }
    }

    // Network errors
    if (error.name === 'TypeError' || error.message.includes('fetch')) {
      apiError.type = ErrorType.NETWORK;
      apiError.isRetryable = true;
      return apiError;
    }

    // Timeout errors
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      apiError.type = ErrorType.TIMEOUT;
      apiError.isRetryable = true;
      return apiError;
    }

    // Default to permanent error
    apiError.type = ErrorType.PERMANENT;
    apiError.isRetryable = false;
    return apiError;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    const baseDelay = config.baseDelayMs * Math.pow(config.exponentialBase, attempt - 1);
    const jitter = baseDelay * config.jitterFactor * Math.random();
    const delay = Math.min(baseDelay + jitter, config.maxDelayMs);
    return Math.floor(delay);
  }

  async executeWithResilience<T>(
    serviceName: string,
    config: APIServiceConfig,
    request: () => Promise<Response>
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(serviceName, config.circuitBreaker);
    let lastError: APIError | null = null;

    // Check circuit breaker
    if (!circuitBreaker.canExecute()) {
      const error = new Error(`Circuit breaker [${serviceName}] is OPEN`) as APIError;
      error.type = ErrorType.SERVER_ERROR;
      error.isRetryable = false;
      throw error;
    }

    // Check rate limiting
    if (!this.checkRateLimit(serviceName, config)) {
      const error = new Error(`Rate limit exceeded for [${serviceName}]`) as APIError;
      error.type = ErrorType.RATE_LIMIT;
      error.isRetryable = true;
      error.retryAfter = 60000; // Wait 1 minute
      throw error;
    }

    for (let attempt = 1; attempt <= config.retry.maxAttempts; attempt++) {
      const startTime = Date.now();

      try {
        console.log(`[${serviceName}] Attempt ${attempt}/${config.retry.maxAttempts}`);

        // Create timeout controller
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
          timeoutController.abort();
        }, config.retry.timeoutMs);

        // Execute request with timeout
        const response = await Promise.race([
          request(),
          new Promise<never>((_, reject) => {
            timeoutController.signal.addEventListener('abort', () => {
              reject(new Error('Request timeout'));
            });
          })
        ]);

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`HTTP ${response.status}: ${errorText}`) as APIError;
          const classifiedError = this.classifyError(error, response);
          
          if (!classifiedError.isRetryable || attempt === config.retry.maxAttempts) {
            this.updateMetrics(serviceName, false, responseTime);
            circuitBreaker.onFailure();
            throw classifiedError;
          }

          lastError = classifiedError;
          
          // Handle rate limiting with custom delay
          if (classifiedError.type === ErrorType.RATE_LIMIT && classifiedError.retryAfter) {
            console.log(`[${serviceName}] Rate limited, waiting ${classifiedError.retryAfter}ms`);
            await this.sleep(classifiedError.retryAfter);
            continue;
          }
          
        } else {
          // Success - parse response
          this.updateMetrics(serviceName, true, responseTime);
          circuitBreaker.onSuccess();

          const result = await response.json() as T;
          return result;
        }

      } catch (error) {
        const responseTime = Date.now() - startTime;
        const classifiedError = this.classifyError(error);

        if (!classifiedError.isRetryable || attempt === config.retry.maxAttempts) {
          this.updateMetrics(serviceName, false, responseTime);
          circuitBreaker.onFailure();
          throw classifiedError;
        }

        lastError = classifiedError;
      }

      // Calculate delay for next attempt
      if (attempt < config.retry.maxAttempts) {
        const delay = this.calculateDelay(attempt, config.retry);
        console.log(`[${serviceName}] Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }

    // All attempts failed
    this.updateMetrics(serviceName, false, 0);
    circuitBreaker.onFailure();
    throw lastError || new Error(`All ${config.retry.maxAttempts} attempts failed for ${serviceName}`);
  }

  async healthCheck(serviceName: string, healthEndpoint: string): Promise<{
    healthy: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const response = await fetch(healthEndpoint, {
        method: 'GET',
        timeout: 5000 // 5 second timeout for health checks
      } as any);

      const responseTime = Date.now() - startTime;

      return {
        healthy: response.ok,
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}`
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        healthy: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  getServiceMetrics(): Map<string, RequestMetrics> {
    return new Map(this.metrics);
  }

  getCircuitBreakerStats(): Array<CircuitBreakerStats & { serviceName: string }> {
    return Array.from(this.circuitBreakers.values()).map(cb => cb.getStats());
  }

  resetCircuitBreaker(serviceName: string): void {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (circuitBreaker) {
      // Reset to closed state
      circuitBreaker['stats'].state = CircuitBreakerState.CLOSED;
      circuitBreaker['stats'].failures = 0;
      circuitBreaker['stats'].nextAttemptTime = 0;
      console.log(`Circuit breaker [${serviceName}] manually reset to CLOSED`);
    }
  }
}

// Predefined configurations for external services
export const SERVICE_CONFIGS: Record<string, APIServiceConfig> = {
  LLAMAPARSE: {
    name: 'LlamaParse',
    baseUrl: 'https://api.cloud.llamaindex.ai',
    retry: {
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      exponentialBase: 2,
      jitterFactor: 0.1,
      timeoutMs: 120000 // 2 minutes for PDF processing
    },
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeoutMs: 60000, // 1 minute
      monitoringWindowMs: 300000 // 5 minutes
    },
    rateLimitConfig: {
      maxRequestsPerMinute: 20,
      rateLimitHeaderName: 'x-ratelimit-remaining',
      retryAfterHeaderName: 'retry-after'
    }
  },
  
  OPENAI: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    retry: {
      maxAttempts: 4,
      baseDelayMs: 2000,
      maxDelayMs: 60000,
      exponentialBase: 2,
      jitterFactor: 0.2,
      timeoutMs: 30000 // 30 seconds for embeddings
    },
    circuitBreaker: {
      failureThreshold: 3,
      resetTimeoutMs: 120000, // 2 minutes  
      monitoringWindowMs: 300000 // 5 minutes
    },
    rateLimitConfig: {
      maxRequestsPerMinute: 60,
      rateLimitHeaderName: 'x-ratelimit-remaining-requests',
      retryAfterHeaderName: 'retry-after'
    }
  },

  SUPABASE: {
    name: 'Supabase',
    baseUrl: 'https://supabase.co',
    retry: {
      maxAttempts: 3,
      baseDelayMs: 500,
      maxDelayMs: 10000,
      exponentialBase: 1.5,
      jitterFactor: 0.1,
      timeoutMs: 10000 // 10 seconds
    },
    circuitBreaker: {
      failureThreshold: 10,
      resetTimeoutMs: 30000, // 30 seconds
      monitoringWindowMs: 300000 // 5 minutes
    },
    rateLimitConfig: {
      maxRequestsPerMinute: 100,
      rateLimitHeaderName: 'x-ratelimit-remaining',
      retryAfterHeaderName: 'retry-after'
    }
  }
};

// Convenience functions for common API patterns
export async function resilientFetch<T>(
  serviceName: keyof typeof SERVICE_CONFIGS,
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const client = ResilientAPIClient.getInstance();
  const config = SERVICE_CONFIGS[serviceName];

  return client.executeWithResilience<T>(
    config.name,
    config,
    () => fetch(url, options)
  );
}

export async function checkAllServicesHealth(): Promise<{
  overall: boolean;
  services: Record<string, { healthy: boolean; responseTime: number; error?: string }>;
}> {
  const client = ResilientAPIClient.getInstance();
  
  const healthChecks = {
    LLAMAPARSE: 'https://api.cloud.llamaindex.ai/api/health',
    OPENAI: 'https://api.openai.com/v1/engines',
    // Supabase health check would be specific to your instance
  };

  const results: Record<string, { healthy: boolean; responseTime: number; error?: string }> = {};
  
  const promises = Object.entries(healthChecks).map(async ([service, endpoint]) => {
    try {
      const result = await client.healthCheck(service, endpoint);
      results[service] = result;
    } catch (error) {
      results[service] = {
        healthy: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  await Promise.allSettled(promises);

  const overall = Object.values(results).every(r => r.healthy);

  return { overall, services: results };
}

// Export singleton instance
export const resilientApiClient = ResilientAPIClient.getInstance();