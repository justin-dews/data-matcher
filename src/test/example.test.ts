import { describe, it, expect } from 'vitest'

describe('Testing Framework Setup', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true)
  })

  it('should support TypeScript', () => {
    const message: string = 'Hello Test'
    expect(message).toBe('Hello Test')
  })

  it('should have access to process.env', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co')
  })
})