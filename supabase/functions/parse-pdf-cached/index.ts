/**
 * Optimized LlamaParse PDF processing with comprehensive caching
 * Achieves major cost reduction by caching identical document processing
 * Implements file hash-based caching to avoid duplicate API calls
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Interfaces (same as original)
interface TableRow {
  cells: string[];
  lineNumber: number;
}

interface Table {
  headers: string[];
  rows: TableRow[];
  startLine: number;
  endLine: number;
}

interface LineItem {
  id: string;
  item_number: string;
  part_number: string;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  total: number | null;
  uom: string;
  raw_row: string;
  position: number;
  source_line: number;
}

interface ExtractedTable {
  headers: string[];
  rows: string[][];
  tableType: 'line_items' | 'metadata' | 'unknown';
  confidence: number;
}

interface CachedParseResult {
  success: boolean;
  lineItems: any[];
  metadata: {
    total_items: number;
    total_tables: number;
    parse_time: string;
    parsing_method: string;
    cached: boolean;
    file_hash: string;
  };
}

interface ParseCacheEntry {
  result: CachedParseResult;
  timestamp: number;
  ttl: number;
  accessCount: number;
  fileSize: number;
}

/**
 * Document Processing Cache with file hash-based storage
 */
class DocumentParseCache {
  private cache = new Map<string, ParseCacheEntry>();
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_ENTRIES = 1000;
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB max per file
  
  private hits = 0;
  private misses = 0;

  /**
   * Generate SHA-256 hash from file buffer
   */
  async generateFileHash(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32);
  }

  /**
   * Get cached parse result by file hash
   */
  get(fileHash: string): CachedParseResult | null {
    const entry = this.cache.get(fileHash);
    
    if (!entry || this.isExpired(entry)) {
      if (entry) {
        this.cache.delete(fileHash);
      }
      this.misses++;
      return null;
    }

    entry.accessCount++;
    this.hits++;
    
    // Return cached result with updated metadata
    return {
      ...entry.result,
      metadata: {
        ...entry.result.metadata,
        cached: true,
        cache_hit: true
      }
    };
  }

  /**
   * Store parse result in cache
   */
  set(fileHash: string, result: CachedParseResult, fileSize: number): void {
    if (fileSize > this.MAX_FILE_SIZE) {
      console.log(`File too large for cache: ${fileSize} bytes`);
      return;
    }

    this.cache.set(fileHash, {
      result: {
        ...result,
        metadata: {
          ...result.metadata,
          file_hash: fileHash
        }
      },
      timestamp: Date.now(),
      ttl: this.TTL,
      accessCount: 1,
      fileSize
    });

    this.evictIfNeeded();
    console.log(`Cached parse result for hash: ${fileHash}`);
  }

  private isExpired(entry: ParseCacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictIfNeeded(): void {
    if (this.cache.size <= this.MAX_ENTRIES) return;

    // Calculate total cache size
    const totalSize = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.fileSize, 0);

    // Evict oldest entries if over size/count limit
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => {
        // Score based on access frequency and recency
        const scoreA = a.accessCount / (Date.now() - a.timestamp + 1);
        const scoreB = b.accessCount / (Date.now() - b.timestamp + 1);
        return scoreA - scoreB;
      });

    const toRemove = Math.max(
      Math.ceil(this.MAX_ENTRIES * 0.1), // Remove at least 10%
      this.cache.size - this.MAX_ENTRIES + 1
    );

    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const [hash] = entries[i];
      this.cache.delete(hash);
    }

    console.log(`Evicted ${toRemove} cache entries, size: ${this.cache.size}`);
  }

  getStats() {
    const totalRequests = this.hits + this.misses;
    const totalSize = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.fileSize, 0);

    return {
      size: this.cache.size,
      maxSize: this.MAX_ENTRIES,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? ((this.hits / totalRequests) * 100).toFixed(2) : '0',
      totalRequests,
      totalCacheSize: (totalSize / 1024 / 1024).toFixed(2) + ' MB',
      averageFileSize: this.cache.size > 0 ? ((totalSize / this.cache.size) / 1024).toFixed(2) + ' KB' : '0 KB'
    };
  }

  clearExpired(): number {
    const expired: string[] = [];
    
    for (const [hash, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expired.push(hash);
      }
    }
    
    expired.forEach(hash => this.cache.delete(hash));
    return expired.length;
  }
}

// Global cache instance
const parseCache = new DocumentParseCache();

// Import all parsing functions from original (abbreviated for space)
// ... [All the parsing functions from the original file] ...

// Enhanced column mapping patterns (same as original)
const ADAPTIVE_COLUMN_PATTERNS = {
  item_identifier: [
    /^item$/i, /^sku$/i, /^part[\s_-]?number$/i, /^part[\s_-]?num$/i, /^part$/i,
    /^product[\s_-]?code$/i, /^model$/i, /^model[\s_-]?number$/i,
    /^catalog[\s_-]?number$/i, /^catalog$/i, /^item[\s_-]?code$/i,
    /^product[\s_-]?id$/i, /^item[\s_-]?id$/i, /^mfg[\s_-]?part$/i, /^manufacturer[\s_-]?part$/i
  ],
  description: [
    /^description$/i, /^product[\s_-]?description$/i, /^item[\s_-]?description$/i,
    /^product[\s_-]?name$/i, /^name$/i, /^title$/i, /^details$/i,
    /^spec$/i, /^specification$/i
  ],
  quantity: [
    /^qty$/i, /^quantity$/i, /^quan$/i, /^amount$/i, /^count$/i,
    /^ordered$/i, /^order[\s_-]?qty$/i, /^ship[\s_-]?qty$/i
  ],
  unit_price: [
    /^unit[\s_-]?price$/i, /^price$/i, /^cost$/i, /^rate$/i,
    /^unit[\s_-]?cost$/i, /^each$/i, /^per[\s_-]?unit$/i,
    /^list[\s_-]?price$/i, /^selling[\s_-]?price$/i
  ],
  total_price: [
    /^total$/i, /^amount$/i, /^extended$/i, /^extended[\s_-]?price$/i,
    /^line[\s_-]?total$/i, /^subtotal$/i, /^net[\s_-]?amount$/i
  ],
  uom: [
    /^u[\/\s_-]?m$/i, /^unit$/i, /^units$/i, /^uom$/i, /^each$/i, /^ea$/i
  ]
};

// Include all parsing functions from original file
// [Abbreviated - would include all functions like parseHTMLTables, parseIndividualHTMLTable, etc.]

// For brevity, I'll include the key optimized functions:

/**
 * Optimized file download with caching awareness
 */
async function downloadFileFromStorageOptimized(supabase: any, storagePath: string) {
  console.log('Downloading file from storage for processing:', storagePath);
  
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('documents')
    .download(storagePath);

  if (downloadError) {
    console.error('Error downloading file:', downloadError);
    throw new Error(`Failed to download file: ${downloadError.message}`);
  }

  console.log('File downloaded successfully, size:', fileData.size);
  return fileData;
}

/**
 * Enhanced LlamaParse upload with retry logic and optimization
 */
async function uploadToLlamaParseOptimized(fileData: Blob, llamaCloudApiKey: string) {
  const formData = new FormData();
  formData.append('file', fileData, 'document.pdf');
  formData.append('parsing_instruction', 'Extract line items, product descriptions, quantities, and prices from this invoice/quote document. Focus on structured table data.');
  formData.append('parse_mode', 'parse_page_with_agent');
  formData.append('adaptive_long_table', 'true');
  formData.append('outlined_table_extraction', 'true');
  formData.append('high_res_ocr', 'true');
  formData.append('model', 'anthropic-sonnet-4.0');
  formData.append('output_tables_as_HTML', 'true');

  console.log('Uploading to LlamaParse API...');
  
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`LlamaParse upload attempt ${attempt}/3`);
      
      const parseResponse = await fetch('https://api.cloud.llamaindex.ai/api/v1/parsing/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${llamaCloudApiKey}`,
        },
        body: formData,
      });

      if (!parseResponse.ok) {
        const errorText = await parseResponse.text();
        console.error('LlamaParse API error:', errorText);
        throw new Error(`LlamaParse API error: ${parseResponse.status} ${errorText}`);
      }

      const uploadResult = await parseResponse.json();
      console.log('Upload result received, job ID:', uploadResult.id);
      return uploadResult.id;
      
    } catch (error) {
      console.error(`Upload attempt ${attempt} failed:`, error.message);
      lastError = error;
      
      if (attempt < 3) {
        const delay = attempt * 2000; // Progressive backoff
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`LlamaParse upload failed after 3 attempts. Last error: ${lastError.message}`);
}

/**
 * Optimized polling with exponential backoff
 */
async function waitForParsingCompletionOptimized(jobId: string, llamaCloudApiKey: string) {
  console.log('Polling for job completion with optimized timing...');
  let attempts = 0;
  const maxAttempts = 36; // ~6 minutes max with exponential backoff
  
  while (attempts < maxAttempts) {
    try {
      const statusResponse = await fetch(`https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${llamaCloudApiKey}`,
        },
      });

      if (!statusResponse.ok) {
        console.error('Status check failed:', statusResponse.status);
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
        continue;
      }

      const jobResult = await statusResponse.json();
      console.log(`Job status (attempt ${attempts + 1}):`, jobResult.status);

      if (jobResult.status === 'SUCCESS') {
        console.log('Parsing completed successfully');
        return jobResult;
      } else if (jobResult.status === 'ERROR') {
        throw new Error(`Parsing failed: ${jobResult.error || 'Unknown error'}`);
      }

      // Progressive delay: start with 5s, max 15s
      const delay = Math.min(5000 + (attempts * 1000), 15000);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempts++;
      
    } catch (error) {
      console.error(`Status check attempt ${attempts + 1} failed:`, error);
      attempts++;
      
      if (attempts >= maxAttempts) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  throw new Error('Parsing timed out after maximum attempts');
}

/**
 * Fetch results with retry logic
 */
async function fetchParsingResultsOptimized(jobId: string, llamaCloudApiKey: string) {
  console.log('Fetching markdown result...');
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const markdownResponse = await fetch(`https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}/result/markdown`, {
        headers: {
          'Authorization': `Bearer ${llamaCloudApiKey}`,
        },
      });

      if (!markdownResponse.ok) {
        throw new Error(`Failed to fetch markdown results: ${markdownResponse.status}`);
      }

      const rawData = await markdownResponse.text();
      console.log('Raw result length:', rawData?.length);

      // Parse JSON response to extract markdown
      let markdownData;
      try {
        const jsonData = JSON.parse(rawData);
        markdownData = jsonData.markdown || rawData;
      } catch (error) {
        markdownData = rawData;
      }

      return markdownData;
      
    } catch (error) {
      console.error(`Fetch attempt ${attempt} failed:`, error.message);
      
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw error;
      }
    }
  }
}

// Include adaptive parsing functions (abbreviated for space)
function parseAdaptiveTableFormat(content: string): LineItem[] {
  console.log('Starting adaptive table parsing...');
  
  if (content.includes('<table') && content.includes('</table>')) {
    console.log('Detected HTML table format');
    const htmlTables = parseHTMLTables(content);
    return convertTablesToLineItems(htmlTables);
  }
  
  console.log('No HTML tables detected, using markdown parser');
  const { tables } = parseMarkdownTables(content);
  return extractLineItemsFromTables(tables);
}

// ... [Include all other parsing functions from original file]
// For brevity, I'll focus on the caching integration:

serve(async (req: any) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  try {
    console.log('Starting optimized PDF parsing request with caching');
    
    const { storagePath } = await req.json();
    
    if (!storagePath) {
      throw new Error('Storage path is required');
    }

    // Validate environment variables
    const llamaCloudApiKey = Deno.env.get('LLAMA_CLOUD_API_KEY');
    if (!llamaCloudApiKey) {
      throw new Error('LLAMA_CLOUD_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download file from storage
    const fileData = await downloadFileFromStorageOptimized(supabase, storagePath);
    
    // Generate file hash for caching
    const fileBuffer = await fileData.arrayBuffer();
    const fileHash = await parseCache.generateFileHash(fileBuffer);
    
    console.log(`Generated file hash: ${fileHash} (${fileData.size} bytes)`);

    // Check cache first
    const cachedResult = parseCache.get(fileHash);
    if (cachedResult) {
      console.log('🎯 CACHE HIT! Returning cached parse result');
      console.log(`Cache stats: ${parseCache.getStats().hitRate}% hit rate`);
      
      return new Response(
        JSON.stringify(cachedResult),
        {
          headers: { 
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json' 
          },
        }
      );
    }

    console.log('Cache miss, processing document with LlamaParse');
    const startTime = Date.now();

    // Process with LlamaParse API
    const jobId = await uploadToLlamaParseOptimized(fileData, llamaCloudApiKey);
    await waitForParsingCompletionOptimized(jobId, llamaCloudApiKey);
    const markdownData = await fetchParsingResultsOptimized(jobId, llamaCloudApiKey);

    // Parse with adaptive algorithm
    const lineItems = parseAdaptiveTableFormat(markdownData);
    console.log(`Extracted ${lineItems.length} line items using adaptive parser`);
    
    const processingTime = Date.now() - startTime;
    
    // Determine parsing method
    const usedHtmlTables = markdownData.includes('<table') && markdownData.includes('</table>');
    const parsingMethod = usedHtmlTables ? 'html_tables' : 'markdown_tables';
    
    // Count tables
    let tableCount = 0;
    if (usedHtmlTables) {
      const tableMatches = markdownData.match(/<table[\s\S]*?<\/table>/gi);
      tableCount = tableMatches ? tableMatches.length : 0;
    } else {
      const { tables } = parseMarkdownTables(markdownData);
      tableCount = tables.length;
    }

    // Format response
    const result: CachedParseResult = {
      success: true,
      lineItems: lineItems.map((item: any, index: number) => ({
        id: item.id,
        item_number: item.item_number,
        part_number: item.part_number,
        raw_text: item.description || item.part_number || item.raw_row,
        normalized_text: (item.description || item.part_number || item.raw_row).toLowerCase().trim(),
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        uom: item.uom,
        position: item.position,
        source_line: item.source_line,
        raw_row: item.raw_row
      })),
      metadata: {
        total_items: lineItems.length,
        total_tables: tableCount,
        parse_time: new Date().toISOString(),
        parsing_method: parsingMethod,
        cached: false,
        file_hash: fileHash,
        processing_time_ms: processingTime,
        cache_stats: parseCache.getStats()
      }
    };

    // Cache the result
    parseCache.set(fileHash, result, fileData.size);
    
    console.log(`✅ Processing complete: ${processingTime}ms, cached for future use`);

    return new Response(
      JSON.stringify(result),
      {
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json' 
        },
      }
    );

  } catch (error) {
    console.error('Error in optimized parse-pdf function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
        cache_stats: parseCache.getStats()
      }),
      {
        status: 500,
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json' 
        },
      }
    );
  }
});

// Simplified parsing functions for brevity - in real implementation, include all from original
function parseHTMLTables(markdownText: string): ExtractedTable[] {
  // ... [Implementation from original file]
  return [];
}

function convertTablesToLineItems(tables: ExtractedTable[]): LineItem[] {
  // ... [Implementation from original file]  
  return [];
}

function parseMarkdownTables(markdownText: string): { tables: Table[], totalLineItems: number } {
  // ... [Implementation from original file]
  return { tables: [], totalLineItems: 0 };
}

function extractLineItemsFromTables(tables: Table[]): LineItem[] {
  // ... [Implementation from original file]
  return [];
}