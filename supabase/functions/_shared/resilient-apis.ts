/**
 * Resilient API integrations for Supabase Edge Functions
 * 
 * This module provides resilient wrappers for external API calls with:
 * - Exponential backoff retry logic
 * - Circuit breaker patterns
 * - Rate limit handling
 * - Timeout management
 * - Error classification and recovery
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

export interface ResilientAPIError extends Error {
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

class EdgeCircuitBreaker {
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
          console.log(`Circuit breaker [${this.serviceName}]: OPEN -> HALF_OPEN`);
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        return true;
    }
  }

  onSuccess(): void {
    this.stats.successes++;
    
    if (this.stats.state === CircuitBreakerState.HALF_OPEN) {
      this.stats.state = CircuitBreakerState.CLOSED;
      this.stats.failures = 0;
      console.log(`Circuit breaker [${this.serviceName}]: HALF_OPEN -> CLOSED`);
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
    console.log(`Circuit breaker [${this.serviceName}]: -> OPEN (reset in ${this.config.resetTimeoutMs}ms)`);
  }

  getStats(): CircuitBreakerStats & { serviceName: string } {
    return { ...this.stats, serviceName: this.serviceName };
  }
}

// Global circuit breakers for edge functions
const circuitBreakers: Map<string, EdgeCircuitBreaker> = new Map();

function getCircuitBreaker(serviceName: string, config: CircuitBreakerConfig): EdgeCircuitBreaker {
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, new EdgeCircuitBreaker(serviceName, config));
  }
  return circuitBreakers.get(serviceName)!;
}

function classifyError(error: any, response?: Response): ResilientAPIError {
  const apiError = error as ResilientAPIError;
  apiError.isRetryable = false;
  apiError.originalError = error;

  if (response) {
    apiError.statusCode = response.status;

    // Rate limiting (429) - always retryable
    if (response.status === 429) {
      apiError.type = ErrorType.RATE_LIMIT;
      apiError.isRetryable = true;
      const retryAfter = response.headers.get('Retry-After') || response.headers.get('retry-after');
      if (retryAfter) {
        apiError.retryAfter = parseInt(retryAfter) * 1000;
      }
      return apiError;
    }

    // Server errors (5xx) - retryable
    if (response.status >= 500) {
      apiError.type = ErrorType.SERVER_ERROR;
      apiError.isRetryable = true;
      return apiError;
    }

    // Authentication errors - not retryable
    if (response.status === 401 || response.status === 403) {
      apiError.type = ErrorType.AUTHENTICATION;
      apiError.isRetryable = false;
      return apiError;
    }

    // Other client errors - not retryable
    if (response.status >= 400) {
      apiError.type = ErrorType.CLIENT_ERROR;
      apiError.isRetryable = false;
      return apiError;
    }
  }

  // Network/fetch errors - retryable
  if (error.name === 'TypeError' || error.message?.includes('fetch') || error.message?.includes('network')) {
    apiError.type = ErrorType.NETWORK;
    apiError.isRetryable = true;
    return apiError;
  }

  // Timeout errors - retryable
  if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
    apiError.type = ErrorType.TIMEOUT;
    apiError.isRetryable = true;
    return apiError;
  }

  // Default to permanent error
  apiError.type = ErrorType.PERMANENT;
  apiError.isRetryable = false;
  return apiError;
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  const baseDelay = config.baseDelayMs * Math.pow(config.exponentialBase, attempt - 1);
  const jitter = baseDelay * config.jitterFactor * Math.random();
  const delay = Math.min(baseDelay + jitter, config.maxDelayMs);
  return Math.floor(delay);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function resilientFetch<T>(
  serviceName: string,
  retryConfig: RetryConfig,
  circuitBreakerConfig: CircuitBreakerConfig,
  request: () => Promise<Response>
): Promise<T> {
  const circuitBreaker = getCircuitBreaker(serviceName, circuitBreakerConfig);
  let lastError: ResilientAPIError | null = null;

  // Check circuit breaker
  if (!circuitBreaker.canExecute()) {
    const error = new Error(`Circuit breaker [${serviceName}] is OPEN`) as ResilientAPIError;
    error.type = ErrorType.SERVER_ERROR;
    error.isRetryable = false;
    throw error;
  }

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    const startTime = Date.now();

    try {
      console.log(`[${serviceName}] Attempt ${attempt}/${retryConfig.maxAttempts}`);

      // Create timeout controller
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, retryConfig.timeoutMs);

      // Execute request with timeout
      const response = await Promise.race([
        request(),
        new Promise<never>((_, reject) => {
          timeoutController.signal.addEventListener('abort', () => {
            reject(new Error('Request timeout') as ResilientAPIError);
          });
        })
      ]);

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`HTTP ${response.status}: ${errorText}`) as ResilientAPIError;
        const classifiedError = classifyError(error, response);
        
        console.log(`[${serviceName}] HTTP ${response.status} error: ${classifiedError.type} (retryable: ${classifiedError.isRetryable})`);

        if (!classifiedError.isRetryable || attempt === retryConfig.maxAttempts) {
          circuitBreaker.onFailure();
          throw classifiedError;
        }

        lastError = classifiedError;
        
        // Handle rate limiting with custom delay
        if (classifiedError.type === ErrorType.RATE_LIMIT && classifiedError.retryAfter) {
          console.log(`[${serviceName}] Rate limited, waiting ${classifiedError.retryAfter}ms`);
          await sleep(classifiedError.retryAfter);
          continue;
        }
        
      } else {
        // Success
        circuitBreaker.onSuccess();
        console.log(`[${serviceName}] Success in ${responseTime}ms`);

        const result = await response.json() as T;
        return result;
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const classifiedError = classifyError(error);

      console.log(`[${serviceName}] Error: ${classifiedError.type} - ${classifiedError.message} (retryable: ${classifiedError.isRetryable})`);

      if (!classifiedError.isRetryable || attempt === retryConfig.maxAttempts) {
        circuitBreaker.onFailure();
        throw classifiedError;
      }

      lastError = classifiedError;
    }

    // Calculate delay for next attempt
    if (attempt < retryConfig.maxAttempts) {
      const delay = calculateDelay(attempt, retryConfig);
      console.log(`[${serviceName}] Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }

  // All attempts failed
  circuitBreaker.onFailure();
  throw lastError || new Error(`All ${retryConfig.maxAttempts} attempts failed for ${serviceName}`);
}

// Predefined configurations for edge functions
export const EDGE_SERVICE_CONFIGS = {
  LLAMAPARSE_RETRY: {
    maxAttempts: 5,
    baseDelayMs: 2000,
    maxDelayMs: 30000,
    exponentialBase: 2,
    jitterFactor: 0.2,
    timeoutMs: 180000 // 3 minutes for PDF processing
  } as RetryConfig,
  
  LLAMAPARSE_CIRCUIT_BREAKER: {
    failureThreshold: 5,
    resetTimeoutMs: 300000 // 5 minutes
  } as CircuitBreakerConfig,

  OPENAI_RETRY: {
    maxAttempts: 4,
    baseDelayMs: 2000,
    maxDelayMs: 60000,
    exponentialBase: 2,
    jitterFactor: 0.2,
    timeoutMs: 60000 // 1 minute for embeddings
  } as RetryConfig,
  
  OPENAI_CIRCUIT_BREAKER: {
    failureThreshold: 3,
    resetTimeoutMs: 120000 // 2 minutes
  } as CircuitBreakerConfig
};

// Specialized resilient API functions

export interface LlamaParseUploadResult {
  id: string;
  status: string;
}

export interface LlamaParseJobResult {
  status: string;
  error?: string;
}

export interface LlamaParseMarkdownResult {
  markdown: string;
}

export async function resilientLlamaParseUpload(
  fileData: Blob,
  apiKey: string
): Promise<LlamaParseUploadResult> {
  const formData = new FormData();
  formData.append('file', fileData, 'document.pdf');
  formData.append('parsing_instruction', 'Extract line items, product descriptions, quantities, and prices from this invoice/quote document.');
  formData.append('parse_mode', 'parse_page_with_agent');
  formData.append('adaptive_long_table', 'true');
  formData.append('outlined_table_extraction', 'true');
  formData.append('high_res_ocr', 'true');
  formData.append('model', 'anthropic-sonnet-4.0');
  formData.append('output_tables_as_HTML', 'true');

  return resilientFetch<LlamaParseUploadResult>(
    'LlamaParse-Upload',
    EDGE_SERVICE_CONFIGS.LLAMAPARSE_RETRY,
    EDGE_SERVICE_CONFIGS.LLAMAPARSE_CIRCUIT_BREAKER,
    () => fetch('https://api.cloud.llamaindex.ai/api/v1/parsing/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    })
  );
}

export async function resilientLlamaParseJobStatus(
  jobId: string,
  apiKey: string
): Promise<LlamaParseJobResult> {
  return resilientFetch<LlamaParseJobResult>(
    'LlamaParse-Status',
    {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      exponentialBase: 1.5,
      jitterFactor: 0.1,
      timeoutMs: 10000
    },
    EDGE_SERVICE_CONFIGS.LLAMAPARSE_CIRCUIT_BREAKER,
    () => fetch(`https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })
  );
}

export async function resilientLlamaParseResults(
  jobId: string,
  apiKey: string
): Promise<LlamaParseMarkdownResult> {
  const result = await resilientFetch<any>(
    'LlamaParse-Results',
    EDGE_SERVICE_CONFIGS.LLAMAPARSE_RETRY,
    EDGE_SERVICE_CONFIGS.LLAMAPARSE_CIRCUIT_BREAKER,
    () => fetch(`https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}/result/markdown`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })
  );

  // Handle both string and JSON responses
  if (typeof result === 'string') {
    try {
      const jsonData = JSON.parse(result);
      return { markdown: jsonData.markdown || result };
    } catch {
      return { markdown: result };
    }
  }

  return { markdown: result.markdown || JSON.stringify(result) };
}

export interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

export async function resilientOpenAIEmbeddings(
  texts: string[],
  apiKey: string,
  model: string = 'text-embedding-ada-002'
): Promise<OpenAIEmbeddingResponse> {
  if (texts.length === 0) {
    return {
      data: [],
      usage: { prompt_tokens: 0, total_tokens: 0 }
    };
  }

  return resilientFetch<OpenAIEmbeddingResponse>(
    'OpenAI-Embeddings',
    EDGE_SERVICE_CONFIGS.OPENAI_RETRY,
    EDGE_SERVICE_CONFIGS.OPENAI_CIRCUIT_BREAKER,
    () => fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model: model,
      }),
    })
  );
}

// Health check functions
export async function checkLlamaParseHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.cloud.llamaindex.ai/api/health', {
      method: 'GET',
      timeout: 5000
    } as any);

    return {
      healthy: response.ok,
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function checkOpenAIHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    // Use a lightweight endpoint for health checking
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      timeout: 5000
    } as any);

    return {
      healthy: response.ok,
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export function getCircuitBreakerStats(): Array<CircuitBreakerStats & { serviceName: string }> {
  return Array.from(circuitBreakers.values()).map(cb => cb.getStats());
}