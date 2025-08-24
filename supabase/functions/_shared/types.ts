// Shared types for PathoptMatch Edge Functions

export interface Database {
  public: {
    Tables: {
      documents: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          filename: string;
          file_size: number | null;
          file_path: string;
          status: 'uploading' | 'parsing' | 'parsed' | 'failed';
          parse_job_id: string | null;
          parse_result: any | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          filename: string;
          file_size?: number | null;
          file_path: string;
          status?: 'uploading' | 'parsing' | 'parsed' | 'failed';
          parse_job_id?: string | null;
          parse_result?: any | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          filename?: string;
          file_size?: number | null;
          file_path?: string;
          status?: 'uploading' | 'parsing' | 'parsed' | 'failed';
          parse_job_id?: string | null;
          parse_result?: any | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      line_items: {
        Row: {
          id: string;
          document_id: string;
          organization_id: string;
          line_number: number | null;
          raw_text: string;
          parsed_data: any | null;
          quantity: number | null;
          unit_price: number | null;
          total_price: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          organization_id: string;
          line_number?: number | null;
          raw_text: string;
          parsed_data?: any | null;
          quantity?: number | null;
          unit_price?: number | null;
          total_price?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          organization_id?: string;
          line_number?: number | null;
          raw_text?: string;
          parsed_data?: any | null;
          quantity?: number | null;
          unit_price?: number | null;
          total_price?: number | null;
          created_at?: string;
        };
      };
      product_embeddings: {
        Row: {
          id: string;
          product_id: string;
          embedding: number[];
          text_content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          embedding: number[];
          text_content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          embedding?: number[];
          text_content?: string;
          created_at?: string;
        };
      };
    };
  };
}

// LlamaParse API types
export interface LlamaParseJobResponse {
  id: string;
  status: 'SUCCESS' | 'PENDING' | 'ERROR';
  result?: {
    markdown: string;
    pages: Array<{
      page: number;
      md: string;
      items: Array<{
        type: string;
        bbox: number[];
        content: string;
      }>;
    }>;
  };
  error?: string;
}

export interface LlamaParseLineItem {
  line_number: number;
  description: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  sku?: string;
  manufacturer?: string;
  category?: string;
}

export interface ParsedInvoiceData {
  line_items: LlamaParseLineItem[];
  metadata: {
    total_lines: number;
    invoice_number?: string;
    vendor?: string;
    date?: string;
  };
}

// OpenAI API types
export interface OpenAIEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingRequest {
  texts: string[];
  product_ids?: string[];
}

export interface EmbeddingResult {
  embeddings: number[][];
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// Error types
export interface APIError {
  error: string;
  details?: string;
  status_code?: number;
}

// Common response types
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
}

export type APIResponse<T = any> = SuccessResponse<T> | ErrorResponse;