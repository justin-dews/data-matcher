import { createClient } from '@supabase/supabase-js'

// Database types
export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          settings: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          settings?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          settings?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          organization_id: string
          email: string
          full_name: string | null
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          organization_id: string
          email: string
          full_name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          email?: string
          full_name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          organization_id: string
          sku: string
          name: string
          description: string | null
          category: string | null
          manufacturer: string | null
          price: number | null
          metadata: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          sku: string
          name: string
          description?: string | null
          category?: string | null
          manufacturer?: string | null
          price?: number | null
          metadata?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          sku?: string
          name?: string
          description?: string | null
          category?: string | null
          manufacturer?: string | null
          price?: number | null
          metadata?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          filename: string
          file_size: number | null
          file_path: string
          status: 'uploading' | 'parsing' | 'parsed' | 'failed'
          parse_job_id: string | null
          parse_result: Record<string, unknown> | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          filename: string
          file_size?: number | null
          file_path: string
          status?: 'uploading' | 'parsing' | 'parsed' | 'failed'
          parse_job_id?: string | null
          parse_result?: Record<string, unknown> | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          filename?: string
          file_size?: number | null
          file_path?: string
          status?: 'uploading' | 'parsing' | 'parsed' | 'failed'
          parse_job_id?: string | null
          parse_result?: Record<string, unknown> | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      line_items: {
        Row: {
          id: string
          document_id: string
          organization_id: string
          line_number: number | null
          raw_text: string
          parsed_data: Record<string, unknown> | null
          quantity: number | null
          unit_price: number | null
          total_price: number | null
          company_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          organization_id: string
          line_number?: number | null
          raw_text: string
          parsed_data?: Record<string, unknown> | null
          quantity?: number | null
          unit_price?: number | null
          total_price?: number | null
          company_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          organization_id?: string
          line_number?: number | null
          raw_text?: string
          parsed_data?: Record<string, unknown> | null
          quantity?: number | null
          unit_price?: number | null
          total_price?: number | null
          company_name?: string | null
          created_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          line_item_id: string
          product_id: string | null
          organization_id: string
          status: 'pending' | 'approved' | 'rejected' | 'auto_matched'
          confidence_score: number | null
          vector_score: number | null
          trigram_score: number | null
          fuzzy_score: number | null      // Added fuzzy score field
          alias_score: number | null
          learned_score: number | null    // NEW: Added learned score field
          final_score: number | null
          matched_text: string | null
          reasoning: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          line_item_id: string
          product_id?: string | null
          organization_id: string
          status?: 'pending' | 'approved' | 'rejected' | 'auto_matched'
          confidence_score?: number | null
          vector_score?: number | null
          trigram_score?: number | null
          fuzzy_score?: number | null     // Added fuzzy score field
          alias_score?: number | null
          learned_score?: number | null   // NEW: Added learned score field
          final_score?: number | null
          matched_text?: string | null
          reasoning?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          line_item_id?: string
          product_id?: string | null
          organization_id?: string
          status?: 'pending' | 'approved' | 'rejected' | 'auto_matched'
          confidence_score?: number | null
          vector_score?: number | null
          trigram_score?: number | null
          fuzzy_score?: number | null     // Added fuzzy score field
          alias_score?: number | null
          learned_score?: number | null   // NEW: Added learned score field
          final_score?: number | null
          matched_text?: string | null
          reasoning?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      product_embeddings: {
        Row: {
          id: string
          product_id: string
          embedding: number[]
          text_content: string
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          embedding: number[]
          text_content: string
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          embedding?: number[]
          text_content?: string
          created_at?: string
        }
      }
      competitor_aliases: {
        Row: {
          id: string
          organization_id: string
          product_id: string
          competitor_name: string
          competitor_sku: string | null
          confidence_score: number
          created_by: string | null
          approved_at: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          product_id: string
          competitor_name: string
          competitor_sku?: string | null
          confidence_score?: number
          created_by?: string | null
          approved_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          product_id?: string
          competitor_name?: string
          competitor_sku?: string | null
          confidence_score?: number
          created_by?: string | null
          approved_at?: string
          created_at?: string
        }
      }
      match_training_data: {
        Row: {
          id: string
          organization_id: string
          line_item_id: string | null
          line_item_text: string
          line_item_normalized: string
          matched_product_id: string
          product_sku: string
          product_name: string
          product_manufacturer: string | null
          product_category: string | null
          trigram_score: number | null
          fuzzy_score: number | null
          alias_score: number | null
          final_score: number | null
          match_quality: 'excellent' | 'good' | 'fair' | 'poor'
          match_confidence: number
          approved_by: string | null
          approved_at: string
          training_weight: number
          times_referenced: number
          last_referenced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          line_item_id?: string | null
          line_item_text: string
          line_item_normalized: string
          matched_product_id: string
          product_sku: string
          product_name: string
          product_manufacturer?: string | null
          product_category?: string | null
          trigram_score?: number | null
          fuzzy_score?: number | null
          alias_score?: number | null
          final_score?: number | null
          match_quality?: 'excellent' | 'good' | 'fair' | 'poor'
          match_confidence?: number
          approved_by?: string | null
          approved_at?: string
          training_weight?: number
          times_referenced?: number
          last_referenced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          line_item_id?: string | null
          line_item_text?: string
          line_item_normalized?: string
          matched_product_id?: string
          product_sku?: string
          product_name?: string
          product_manufacturer?: string | null
          product_category?: string | null
          trigram_score?: number | null
          fuzzy_score?: number | null
          alias_score?: number | null
          final_score?: number | null
          match_quality?: 'excellent' | 'good' | 'fair' | 'poor'
          match_confidence?: number
          approved_by?: string | null
          approved_at?: string
          training_weight?: number
          times_referenced?: number
          last_referenced_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      settings: {
        Row: {
          id: string
          organization_id: string
          key: string
          value: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          key: string
          value: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          key?: string
          value?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
      }
      activity_log: {
        Row: {
          id: string
          organization_id: string
          user_id: string | null
          action: string
          resource_type: string
          resource_id: string | null
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id?: string | null
          action: string
          resource_type: string
          resource_id?: string | null
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string | null
          action?: string
          resource_type?: string
          resource_id?: string | null
          metadata?: Record<string, unknown>
          created_at?: string
        }
      }
    }
    Functions: {
      hybrid_product_match: {
        Args: {
          query_text: string
          limit_count?: number
          threshold?: number
        }
        Returns: {
          product_id: string
          sku: string
          name: string
          manufacturer: string | null
          vector_score: number
          trigram_score: number
          fuzzy_score: number
          alias_score: number
          learned_score: number
          final_score: number
          matched_via: string
        }[]
      }
    }
  }
}

// Environment variables with fallbacks for development
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://theattidfeqxyaexiqwj.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

// Create a single supabase client for interacting with your database
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Client factory for components
export const createSupabaseClient = () => {
  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

// Admin client for server-side operations
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)