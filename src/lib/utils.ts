import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Type definitions for our domain
export interface LineItem {
  id: string
  document_id: string
  organization_id: string
  line_number: number | null
  raw_text: string
  parsed_data: {
    name?: string
    sku?: string
    manufacturer?: string
    quantity?: number
    unit_price?: number
    total_price?: number
    category?: string
  } | null
  quantity: number | null
  unit_price: number | null
  total_price: number | null
  company_name?: string | null
  created_at: string
}

export interface Product {
  id: string
  organization_id: string
  sku: string
  name: string
  description: string | null
  category: string | null
  manufacturer: string | null
  price: number | null
  metadata: any
  created_at: string
  updated_at: string
}

export interface Match {
  id: string
  line_item_id: string
  product_id: string | null
  organization_id: string
  status: 'pending' | 'approved' | 'rejected' | 'auto_matched'
  confidence_score: number | null
  vector_score: number | null
  trigram_score: number | null
  fuzzy_score: number | null      // NEW: Added fuzzy score field
  alias_score: number | null
  final_score: number | null
  matched_text: string | null
  reasoning: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface MatchCandidate {
  product_id: string
  sku: string
  name: string
  manufacturer: string | null
  vector_score: number
  trigram_score: number
  fuzzy_score: number         // NEW: Added fuzzy score field
  alias_score: number
  final_score: number
  matched_via: string
}

export interface Document {
  id: string
  organization_id: string
  user_id: string
  filename: string
  file_size: number | null
  file_path: string
  status: 'uploading' | 'parsing' | 'parsed' | 'failed'
  parse_job_id: string | null
  parse_result: any | null
  error_message: string | null
  created_at: string
  updated_at: string
}

// Utility functions
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-'
  return new Intl.NumberFormat('en-US').format(num)
}

export function formatPercent(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(num)
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getConfidenceColor(score: number | null): string {
  if (score === null) return 'text-gray-500'
  if (score >= 0.8) return 'text-green-600'
  if (score >= 0.6) return 'text-yellow-600'
  if (score >= 0.4) return 'text-orange-600'
  return 'text-red-600'
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'approved':
    case 'auto_matched':
      return 'text-green-600 bg-green-50'
    case 'pending':
      return 'text-yellow-600 bg-yellow-50'
    case 'rejected':
      return 'text-red-600 bg-red-50'
    case 'parsed':
      return 'text-blue-600 bg-blue-50'
    case 'parsing':
      return 'text-purple-600 bg-purple-50'
    case 'failed':
      return 'text-red-600 bg-red-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function parseLineItem(rawText: string): Partial<LineItem['parsed_data']> {
  // Basic parsing logic - this will be enhanced with AI parsing
  const lines = rawText.split('\n').filter(line => line.trim())
  
  // Try to extract structured data from the raw text
  const result: Partial<LineItem['parsed_data']> = {}
  
  // Look for patterns like SKU, part numbers, quantities, prices
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Try to find SKU/Part Number patterns
    const skuMatch = trimmed.match(/(?:SKU|PART|P\/N|ITEM)[\s:]+([A-Z0-9-]+)/i)
    if (skuMatch && !result.sku) {
      result.sku = skuMatch[1]
    }
    
    // Try to find quantity patterns
    const qtyMatch = trimmed.match(/(?:QTY|QUANTITY)[\s:]+(\d+(?:\.\d+)?)/i)
    if (qtyMatch && !result.quantity) {
      result.quantity = parseFloat(qtyMatch[1])
    }
    
    // Try to find price patterns
    const priceMatch = trimmed.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/i)
    if (priceMatch && !result.unit_price) {
      result.unit_price = parseFloat(priceMatch[1].replace(',', ''))
    }
  }
  
  // First line is often the product name
  if (lines.length > 0 && !result.name) {
    result.name = lines[0].trim()
  }
  
  return result
}

// OpenAI API utilities
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('/api/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })
  
  if (!response.ok) {
    throw new Error('Failed to generate embedding')
  }
  
  const { embedding } = await response.json()
  return embedding
}

// Export configuration constants
export const CONFIG = {
  MATCHING: {
    VECTOR_WEIGHT: 0.0,      // Disabled (no vector matching)  
    TRIGRAM_WEIGHT: 0.5,     // 50% weight - n-gram similarity
    FUZZY_WEIGHT: 0.3,       // 30% weight - Levenshtein distance
    ALIAS_WEIGHT: 0.2,       // 20% weight - learned competitor mappings
    AUTO_APPROVE_THRESHOLD: 0.9,
    CONFIDENCE_THRESHOLD: 0.3,
    MAX_SUGGESTIONS: 10,
  },
  UPLOAD: {
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_TYPES: ['application/pdf'],
  },
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 50,
  },
} as const