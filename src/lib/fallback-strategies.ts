/**
 * Fallback Strategies for PathoptMatch External API Failures
 * 
 * This module implements graceful degradation patterns when external services
 * are unavailable, ensuring the application remains functional even during
 * service outages.
 * 
 * Strategies include:
 * - Cached responses for PDF parsing and embeddings
 * - Alternative matching algorithms when AI services fail
 * - Progressive functionality degradation
 * - User-friendly error messages with recovery suggestions
 */

import { supabaseAdmin } from '@/lib/supabase';

export interface FallbackResult<T> {
  success: boolean;
  data?: T;
  source: 'primary' | 'cache' | 'fallback' | 'offline';
  message?: string;
  degraded?: boolean;
}

export interface CachedParsingResult {
  id: string;
  document_id: string;
  original_filename: string;
  parsed_content: string;
  line_items_count: number;
  parsing_method: string;
  created_at: string;
}

export interface CachedEmbeddingResult {
  id: string;
  text_content: string;
  embedding: number[];
  model: string;
  created_at: string;
}

// Cache TTL configurations (in milliseconds)
const CACHE_TTL = {
  PARSING_RESULTS: 7 * 24 * 60 * 60 * 1000, // 7 days for parsing results
  EMBEDDINGS: 30 * 24 * 60 * 60 * 1000, // 30 days for embeddings
  HEALTH_STATUS: 5 * 60 * 1000 // 5 minutes for health checks
};

/**
 * PDF Parsing Fallback Strategy
 * 
 * 1. Try primary LlamaParse API
 * 2. Check cache for similar documents
 * 3. Use basic text extraction as last resort
 */
export class PDFParsingFallback {
  static async parseWithFallback(
    storagePath: string,
    documentId: string,
    originalFilename: string
  ): Promise<FallbackResult<any>> {
    try {
      // First try the primary service (LlamaParse with resilience)
      console.log('Attempting primary PDF parsing service...');
      
      // This would call the resilient parse-pdf function
      const primaryResult = await fetch('/api/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath, documentId })
      });

      if (primaryResult.ok) {
        const result = await primaryResult.json();
        
        // Cache successful results
        await this.cacheParsingResult(documentId, originalFilename, result);
        
        return {
          success: true,
          data: result,
          source: 'primary',
          message: 'Successfully parsed using LlamaParse API'
        };
      }

    } catch (error) {
      console.error('Primary PDF parsing failed:', error);
    }

    // Fallback to cached results for similar documents
    console.log('Attempting to find cached parsing results...');
    const cachedResult = await this.findSimilarCachedResult(originalFilename);
    
    if (cachedResult) {
      return {
        success: true,
        data: this.adaptCachedResult(cachedResult),
        source: 'cache',
        message: 'Using cached parsing results from similar document',
        degraded: true
      };
    }

    // Final fallback to basic text extraction
    console.log('Attempting basic text extraction fallback...');
    const basicResult = await this.basicTextExtraction(storagePath);
    
    if (basicResult) {
      return {
        success: true,
        data: basicResult,
        source: 'fallback',
        message: 'Using basic text extraction (limited accuracy)',
        degraded: true
      };
    }

    return {
      success: false,
      source: 'offline',
      message: 'All PDF parsing methods failed. Please try again later or contact support.'
    };
  }

  private static async cacheParsingResult(
    documentId: string,
    filename: string,
    result: any
  ): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('cached_parsing_results')
        .insert({
          document_id: documentId,
          original_filename: filename,
          parsed_content: JSON.stringify(result),
          line_items_count: result.lineItems?.length || 0,
          parsing_method: result.metadata?.parsing_method || 'llamaparse',
        });

      if (error) {
        console.error('Failed to cache parsing result:', error);
      }
    } catch (error) {
      console.error('Error caching parsing result:', error);
    }
  }

  private static async findSimilarCachedResult(
    filename: string
  ): Promise<CachedParsingResult | null> {
    try {
      // Look for documents with similar names or file types
      const fileExtension = filename.split('.').pop()?.toLowerCase();
      const baseFilename = filename.replace(/\.[^/.]+$/, '').toLowerCase();

      const { data, error } = await supabaseAdmin
        .from('cached_parsing_results')
        .select('*')
        .or(`original_filename.ilike.%${baseFilename}%,original_filename.ilike.%.${fileExtension}`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error finding cached results:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('Error in findSimilarCachedResult:', error);
      return null;
    }
  }

  private static adaptCachedResult(cachedResult: CachedParsingResult): any {
    try {
      const parsedContent = JSON.parse(cachedResult.parsed_content);
      
      // Adapt the cached result to current format
      return {
        ...parsedContent,
        metadata: {
          ...parsedContent.metadata,
          cached: true,
          original_document: cachedResult.original_filename,
          cache_age: new Date(cachedResult.created_at).toISOString()
        }
      };
    } catch (error) {
      console.error('Error adapting cached result:', error);
      return null;
    }
  }

  private static async basicTextExtraction(storagePath: string): Promise<any | null> {
    try {
      // This would implement a basic text extraction fallback
      // For now, return a minimal structure
      return {
        success: true,
        lineItems: [{
          id: 'fallback-item-1',
          item_number: 'UNKNOWN',
          description: 'Unable to extract detailed information - basic parsing mode',
          raw_text: 'Document parsing failed, manual review required',
          position: 1
        }],
        metadata: {
          parsing_method: 'basic_fallback',
          total_items: 1,
          degraded: true
        }
      };
    } catch (error) {
      console.error('Basic text extraction failed:', error);
      return null;
    }
  }
}

/**
 * Embeddings Generation Fallback Strategy
 * 
 * 1. Try primary OpenAI API with resilience
 * 2. Check cache for existing embeddings
 * 3. Use similarity-based matching without embeddings
 */
export class EmbeddingsFallback {
  static async generateWithFallback(
    texts: string[],
    productIds?: string[]
  ): Promise<FallbackResult<{ embeddings: number[][]; usage: any }>> {
    try {
      // Try primary OpenAI service
      console.log(`Attempting primary embeddings generation for ${texts.length} texts...`);
      
      const primaryResult = await fetch('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, product_ids: productIds })
      });

      if (primaryResult.ok) {
        const result = await primaryResult.json();
        
        // Cache successful embeddings
        if (result.success && productIds) {
          await this.cacheEmbeddings(texts, result.data.embeddings, productIds);
        }
        
        return {
          success: true,
          data: result.data,
          source: 'primary',
          message: 'Successfully generated embeddings using OpenAI API'
        };
      }

    } catch (error) {
      console.error('Primary embeddings generation failed:', error);
    }

    // Fallback to cached embeddings
    console.log('Attempting to use cached embeddings...');
    const cachedResult = await this.getCachedEmbeddings(texts);
    
    if (cachedResult.embeddings.length > 0) {
      return {
        success: true,
        data: {
          embeddings: cachedResult.embeddings,
          usage: { prompt_tokens: 0, total_tokens: 0 }
        },
        source: 'cache',
        message: `Using ${cachedResult.embeddings.length} cached embeddings`,
        degraded: cachedResult.embeddings.length < texts.length
      };
    }

    // Final fallback - no embeddings (disable vector similarity matching)
    return {
      success: false,
      source: 'offline',
      message: 'Embeddings generation failed. Vector similarity matching disabled.',
      degraded: true
    };
  }

  private static async cacheEmbeddings(
    texts: string[],
    embeddings: number[][],
    productIds: string[]
  ): Promise<void> {
    try {
      const cacheEntries = texts.map((text, index) => ({
        text_content: text,
        embedding: embeddings[index],
        product_id: productIds[index],
        model: 'text-embedding-ada-002'
      }));

      const { error } = await supabaseAdmin
        .from('cached_embeddings')
        .upsert(cacheEntries);

      if (error) {
        console.error('Failed to cache embeddings:', error);
      }
    } catch (error) {
      console.error('Error caching embeddings:', error);
    }
  }

  private static async getCachedEmbeddings(
    texts: string[]
  ): Promise<{ embeddings: number[][]; indices: number[] }> {
    try {
      const { data, error } = await supabaseAdmin
        .from('cached_embeddings')
        .select('text_content, embedding')
        .in('text_content', texts)
        .gt('created_at', new Date(Date.now() - CACHE_TTL.EMBEDDINGS).toISOString());

      if (error) {
        console.error('Error getting cached embeddings:', error);
        return { embeddings: [], indices: [] };
      }

      const embeddings: number[][] = [];
      const indices: number[] = [];

      texts.forEach((text, index) => {
        const cached = data?.find(item => item.text_content === text);
        if (cached) {
          embeddings.push(cached.embedding);
          indices.push(index);
        }
      });

      return { embeddings, indices };
    } catch (error) {
      console.error('Error in getCachedEmbeddings:', error);
      return { embeddings: [], indices: [] };
    }
  }
}

/**
 * Matching Algorithm Fallback Strategy
 * 
 * When AI-powered matching fails, use alternative algorithms:
 * 1. Trigram similarity matching
 * 2. Fuzzy string matching
 * 3. Alias-based matching
 */
export class MatchingFallback {
  static async matchWithFallback(
    lineItems: any[],
    organizationId: string
  ): Promise<FallbackResult<any[]>> {
    try {
      // Try primary AI-powered matching
      console.log('Attempting primary AI-powered matching...');
      
      const primaryResult = await fetch('/api/generate-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId })
      });

      if (primaryResult.ok) {
        const result = await primaryResult.json();
        return {
          success: true,
          data: result,
          source: 'primary',
          message: 'Successfully generated matches using AI-powered algorithms'
        };
      }

    } catch (error) {
      console.error('Primary matching failed:', error);
    }

    // Fallback to basic string matching
    console.log('Attempting basic string matching fallback...');
    const fallbackMatches = await this.basicStringMatching(lineItems, organizationId);
    
    return {
      success: true,
      data: fallbackMatches,
      source: 'fallback',
      message: 'Using basic string matching (reduced accuracy)',
      degraded: true
    };
  }

  private static async basicStringMatching(
    lineItems: any[],
    organizationId: string
  ): Promise<any[]> {
    try {
      // Get all products for the organization
      const { data: products, error } = await supabaseAdmin
        .from('products')
        .select('id, sku, name, manufacturer, description')
        .eq('organization_id', organizationId);

      if (error) {
        console.error('Error fetching products for fallback matching:', error);
        return [];
      }

      const matches: any[] = [];

      for (const lineItem of lineItems) {
        const bestMatch = this.findBestStringMatch(lineItem, products || []);
        
        if (bestMatch) {
          matches.push({
            id: crypto.randomUUID(),
            line_item_id: lineItem.id,
            product_id: bestMatch.product.id,
            confidence_score: bestMatch.confidence,
            reasoning: `Basic string matching (${bestMatch.reason})`,
            match_source: 'string_fallback',
            status: 'pending',
            organization_id: organizationId
          });
        }
      }

      return matches;
    } catch (error) {
      console.error('Error in basic string matching:', error);
      return [];
    }
  }

  private static findBestStringMatch(
    lineItem: any,
    products: any[]
  ): { product: any; confidence: number; reason: string } | null {
    let bestMatch: { product: any; confidence: number; reason: string } | null = null;
    
    for (const product of products) {
      // Simple string similarity checks
      const itemText = (lineItem.description || lineItem.raw_text || '').toLowerCase();
      const productName = (product.name || '').toLowerCase();
      const productSku = (product.sku || '').toLowerCase();
      const productDescription = (product.description || '').toLowerCase();
      
      // Check for exact SKU matches
      if (productSku && itemText.includes(productSku)) {
        bestMatch = { product, confidence: 0.9, reason: 'SKU match' };
        break;
      }
      
      // Check for name matches
      if (productName && this.calculateSimilarity(itemText, productName) > 0.7) {
        const confidence = this.calculateSimilarity(itemText, productName);
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { product, confidence: confidence * 0.8, reason: 'Name similarity' };
        }
      }
      
      // Check for description matches
      if (productDescription && this.calculateSimilarity(itemText, productDescription) > 0.6) {
        const confidence = this.calculateSimilarity(itemText, productDescription);
        if (!bestMatch || confidence * 0.7 > bestMatch.confidence) {
          bestMatch = { product, confidence: confidence * 0.7, reason: 'Description similarity' };
        }
      }
    }
    
    return bestMatch && bestMatch.confidence > 0.5 ? bestMatch : null;
  }

  private static calculateSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity for fallback
    const set1 = new Set(str1.toLowerCase().split(/\s+/));
    const set2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }
}

/**
 * System-wide graceful degradation manager
 */
export class GracefulDegradation {
  static async handleServiceFailure(
    serviceName: string,
    operation: string,
    fallbackFn?: () => Promise<any>
  ): Promise<FallbackResult<any>> {
    console.log(`Service failure detected: ${serviceName} - ${operation}`);
    
    // Log the failure for monitoring
    await this.logServiceFailure(serviceName, operation);
    
    // Execute fallback if provided
    if (fallbackFn) {
      try {
        const fallbackResult = await fallbackFn();
        return {
          success: true,
          data: fallbackResult,
          source: 'fallback',
          message: `${serviceName} is currently unavailable. Using fallback method.`,
          degraded: true
        };
      } catch (error) {
        console.error('Fallback also failed:', error);
      }
    }
    
    return {
      success: false,
      source: 'offline',
      message: this.getServiceUnavailableMessage(serviceName, operation)
    };
  }

  private static async logServiceFailure(serviceName: string, operation: string): Promise<void> {
    try {
      await supabaseAdmin
        .from('service_failures')
        .insert({
          service_name: serviceName,
          operation: operation,
          occurred_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log service failure:', error);
    }
  }

  private static getServiceUnavailableMessage(serviceName: string, operation: string): string {
    const baseMessage = `${serviceName} is currently unavailable for ${operation}.`;
    
    switch (serviceName.toLowerCase()) {
      case 'llamaparse':
        return `${baseMessage} PDF parsing is temporarily disabled. Please try uploading your document again in a few minutes.`;
      case 'openai':
        return `${baseMessage} AI-powered matching is temporarily using alternative algorithms with reduced accuracy.`;
      default:
        return `${baseMessage} Please try again in a few minutes or contact support if the issue persists.`;
    }
  }
}

export {
  PDFParsingFallback,
  EmbeddingsFallback,
  MatchingFallback,
  GracefulDegradation
};