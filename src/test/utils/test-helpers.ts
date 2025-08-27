import { vi } from 'vitest'

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  ...overrides
})

export const createMockProfile = (overrides = {}) => ({
  id: 'test-profile-id',
  organization_id: 'test-org-id',
  full_name: 'Test User',
  ...overrides
})

export const createMockLineItem = (overrides = {}) => ({
  id: 'line-item-1',
  raw_text: 'Test Product',
  parsed_data: { name: 'Test Product', quantity: 1, unit_price: 100 },
  ...overrides
})

export const createMockMatchCandidate = (overrides = {}) => ({
  product_id: 'prod-1',
  name: 'Test Product Match',
  final_score: 0.85,
  vector_score: 0.80,
  trigram_score: 0.75,
  fuzzy_score: 0.70,
  alias_score: 0.0,
  matched_via: 'algorithmic',
  ...overrides
})

// Mock factories
export const createMockSupabaseClient = () => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  })),
  rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
  functions: {
    invoke: vi.fn(() => Promise.resolve({ data: null, error: null }))
  }
})

export const createMockFetch = () => vi.fn(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data: {} })
  })
)