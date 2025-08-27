import { NextRequest, NextResponse } from 'next/server'

// Rate limiter configuration interface
export interface RateLimiterConfig {
  windowMs: number      // Time window in milliseconds
  maxRequests: number   // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string
  message?: string      // Custom error message
}

// In-memory store for rate limiting
class MemoryStore {
  private hits: Map<string, { count: number; resetTime: number }> = new Map()

  increment(key: string, windowMs: number): { totalHits: number; timeToReset: number; allowed: boolean } {
    const now = Date.now()
    const resetTime = now + windowMs
    
    const current = this.hits.get(key)
    
    if (!current || current.resetTime <= now) {
      // First request or window expired
      this.hits.set(key, { count: 1, resetTime })
      return { totalHits: 1, timeToReset: windowMs, allowed: true }
    }
    
    // Increment existing window
    current.count++
    this.hits.set(key, current)
    
    return {
      totalHits: current.count,
      timeToReset: current.resetTime - now,
      allowed: true // We'll check the limit in the rate limiter
    }
  }

  // Clean expired entries periodically
  cleanup(): void {
    const now = Date.now()
    for (const [key, value] of this.hits.entries()) {
      if (value.resetTime <= now) {
        this.hits.delete(key)
      }
    }
  }
}

const store = new MemoryStore()

// Cleanup expired entries every 10 minutes
setInterval(() => store.cleanup(), 10 * 60 * 1000)

export class RateLimiter {
  private config: Required<RateLimiterConfig>

  constructor(config: RateLimiterConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
      message: config.message || 'Too many requests, please try again later.',
    }
  }

  private defaultKeyGenerator(req: NextRequest): string {
    const ip = this.getClientIP(req)
    return ip
  }

  private getClientIP(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for')
    const realIP = req.headers.get('x-real-ip')
    const cfConnectingIP = req.headers.get('cf-connecting-ip')
    
    if (cfConnectingIP) return cfConnectingIP
    if (realIP) return realIP
    if (forwarded) return forwarded.split(',')[0].trim()
    
    return 'unknown'
  }

  async checkLimit(req: NextRequest): Promise<NextResponse | null> {
    const key = this.config.keyGenerator(req)
    const { totalHits, timeToReset } = store.increment(key, this.config.windowMs)
    
    if (totalHits > this.config.maxRequests) {
      // Rate limit exceeded
      return NextResponse.json(
        { error: this.config.message },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': this.config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil((Date.now() + timeToReset) / 1000).toString(),
            'Retry-After': Math.ceil(timeToReset / 1000).toString(),
          },
        }
      )
    }

    // Add rate limit headers to track usage
    const remaining = Math.max(0, this.config.maxRequests - totalHits)
    
    // We'll add these headers to the response later
    return null
  }

  // Helper to add rate limit headers to successful responses
  addHeaders(response: NextResponse, req: NextRequest): NextResponse {
    const key = this.config.keyGenerator(req)
    const current = store.hits.get(key)
    
    if (current) {
      const remaining = Math.max(0, this.config.maxRequests - current.count)
      response.headers.set('X-RateLimit-Limit', this.config.maxRequests.toString())
      response.headers.set('X-RateLimit-Remaining', remaining.toString())
      response.headers.set('X-RateLimit-Reset', Math.ceil(current.resetTime / 1000).toString())
    }
    
    return response
  }
}

// Predefined rate limiters for different endpoints
export const rateLimiters = {
  // General API endpoints - 100 requests per minute
  general: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  }),

  // Upload endpoints - 10 uploads per 5 minutes
  upload: new RateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10,
    message: 'Upload limit exceeded. Please wait before uploading more files.',
  }),

  // Match generation - 20 requests per minute
  matching: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    message: 'Match generation limit exceeded. Please wait before generating more matches.',
  }),

  // Authentication endpoints - 5 attempts per 15 minutes
  auth: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts. Please wait before trying again.',
  }),
}