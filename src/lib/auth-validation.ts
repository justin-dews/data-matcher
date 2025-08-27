import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from './supabase'

export interface AuthContext {
  user: {
    id: string
    email: string
  }
  profile: {
    id: string
    organization_id: string
    full_name: string | null
    role: string
  }
}

// Extract and validate authorization from request
export async function validateAuth(req: NextRequest): Promise<AuthContext | NextResponse> {
  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    
    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, organization_id, full_name, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403 }
      )
    }

    return {
      user: {
        id: user.id,
        email: user.email || ''
      },
      profile
    }

  } catch (error) {
    console.error('Auth validation error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}

// Middleware wrapper for API routes with authentication
export function withAuth(
  handler: (req: NextRequest, auth: AuthContext) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const authResult = await validateAuth(req)
    
    // If validation failed, return the error response
    if (authResult instanceof NextResponse) {
      return authResult
    }
    
    // Authentication successful, call the handler
    return handler(req, authResult)
  }
}

// Role-based access control
export function requireRole(allowedRoles: string[]) {
  return (handler: (req: NextRequest, auth: AuthContext) => Promise<NextResponse>) => {
    return withAuth(async (req: NextRequest, auth: AuthContext) => {
      if (!allowedRoles.includes(auth.profile.role)) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      }
      
      return handler(req, auth)
    })
  }
}

// Organization-based access control
export function requireOrganization(organizationId: string) {
  return (handler: (req: NextRequest, auth: AuthContext) => Promise<NextResponse>) => {
    return withAuth(async (req: NextRequest, auth: AuthContext) => {
      if (auth.profile.organization_id !== organizationId) {
        return NextResponse.json(
          { error: 'Organization access denied' },
          { status: 403 }
        )
      }
      
      return handler(req, auth)
    })
  }
}

// Combined authentication and rate limiting wrapper
export function withAuthAndRateLimit(
  rateLimiter: any,
  handler: (req: NextRequest, auth: AuthContext) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Check rate limit first
    const rateLimitResponse = await rateLimiter.checkLimit(req)
    if (rateLimitResponse) {
      return rateLimitResponse
    }
    
    // Then check authentication
    const authResult = await validateAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    
    // Both checks passed, call handler
    const response = await handler(req, authResult)
    
    // Add rate limit headers to successful response
    return rateLimiter.addHeaders(response, req)
  }
}