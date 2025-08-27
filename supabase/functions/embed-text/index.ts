import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient, corsHeaders } from '../_shared/supabase.ts';
import { resilientOpenAIEmbeddings, ResilientAPIError, ErrorType } from '../_shared/resilient-apis.ts';
import type { 
  OpenAIEmbeddingResponse,
  EmbeddingRequest,
  EmbeddingResult,
  APIResponse 
} from '../_shared/types.ts';

const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-ada-002';
const BATCH_SIZE = 100; // OpenAI allows up to 2048 inputs per request, but we'll be conservative

async function generateEmbeddings(texts: string[]): Promise<EmbeddingResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  if (texts.length === 0) {
    return {
      embeddings: [],
      usage: { prompt_tokens: 0, total_tokens: 0 }
    };
  }

  console.log(`Generating embeddings for ${texts.length} texts using resilient OpenAI integration...`);

  try {
    // Process texts in batches to avoid API limits
    const allEmbeddings: number[][] = [];
    let totalPromptTokens = 0;
    let totalTokens = 0;

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} with ${batch.length} texts`);
      
      const result = await resilientOpenAIEmbeddings(batch, apiKey, EMBEDDING_MODEL);
      
      // Sort embeddings by index to maintain order
      const sortedEmbeddings = result.data
        .sort((a, b) => a.index - b.index)
        .map(item => item.embedding);
      
      allEmbeddings.push(...sortedEmbeddings);
      totalPromptTokens += result.usage.prompt_tokens;
      totalTokens += result.usage.total_tokens;
    }

    console.log(`Successfully generated ${allEmbeddings.length} embeddings. Total tokens: ${totalTokens}`);

    return {
      embeddings: allEmbeddings,
      usage: {
        prompt_tokens: totalPromptTokens,
        total_tokens: totalTokens,
      },
    };

  } catch (error) {
    if (error instanceof Error) {
      const resilientError = error as ResilientAPIError;
      console.error(`OpenAI embeddings failed: ${resilientError.type} - ${resilientError.message}`);
      
      // Provide specific error messaging based on error type
      switch (resilientError.type) {
        case ErrorType.RATE_LIMIT:
          throw new Error(`OpenAI rate limit exceeded. Please try again in a few minutes.`);
        case ErrorType.AUTHENTICATION:
          throw new Error(`OpenAI authentication failed. Please check your API key.`);
        case ErrorType.TIMEOUT:
          throw new Error(`OpenAI request timed out. The request may be too large.`);
        case ErrorType.NETWORK:
          throw new Error(`Network error connecting to OpenAI. Please check your connection.`);
        default:
          throw new Error(`OpenAI embeddings failed: ${resilientError.message}`);
      }
    }
    
    throw error;
  }
}

async function storeProductEmbeddings(
  productIds: string[], 
  texts: string[], 
  embeddings: number[][]
): Promise<void> {
  const supabase = createSupabaseClient();

  if (productIds.length !== texts.length || texts.length !== embeddings.length) {
    throw new Error('Mismatch between productIds, texts, and embeddings arrays');
  }

  const embeddingInserts = productIds.map((productId, index) => ({
    product_id: productId,
    text_content: texts[index],
    embedding: embeddings[index],
  }));

  // First, delete existing embeddings for these products
  if (productIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('product_embeddings')
      .delete()
      .in('product_id', productIds);

    if (deleteError) {
      console.error('Error deleting existing embeddings:', deleteError);
      // Continue anyway - we'll handle duplicates at the database level
    }
  }

  // Insert new embeddings
  const { error: insertError } = await supabase
    .from('product_embeddings')
    .insert(embeddingInserts);

  if (insertError) {
    throw new Error(`Failed to store embeddings: ${insertError.message}`);
  }
}

async function processEmbeddingRequest(request: EmbeddingRequest): Promise<APIResponse<EmbeddingResult>> {
  try {
    if (!request.texts || !Array.isArray(request.texts) || request.texts.length === 0) {
      return {
        success: false,
        error: 'texts array is required and must not be empty',
      };
    }

    // Validate text content
    const validTexts = request.texts.filter(text => 
      typeof text === 'string' && text.trim().length > 0
    );

    if (validTexts.length === 0) {
      return {
        success: false,
        error: 'No valid text strings provided',
      };
    }

    // Clean and prepare texts for embedding
    const cleanedTexts = validTexts.map(text => 
      text.trim().replace(/\s+/g, ' ').substring(0, 8000) // OpenAI has token limits
    );

    // Generate embeddings
    const result = await generateEmbeddings(cleanedTexts);

    // If product_ids are provided, store the embeddings
    if (request.product_ids && Array.isArray(request.product_ids)) {
      if (request.product_ids.length !== cleanedTexts.length) {
        return {
          success: false,
          error: 'product_ids array length must match texts array length',
        };
      }

      await storeProductEmbeddings(request.product_ids, cleanedTexts, result.embeddings);
    }

    return {
      success: true,
      data: result,
    };

  } catch (error) {
    console.error('Error processing embedding request:', error);
    return {
      success: false,
      error: 'Failed to generate embeddings',
      details: error.message,
    };
  }
}

// Helper function to get product embeddings for similarity search
async function getProductEmbeddings(organizationId?: string, productIds?: string[]) {
  const supabase = createSupabaseClient();

  let query = supabase
    .from('product_embeddings')
    .select(`
      id,
      product_id,
      embedding,
      text_content,
      products!inner(
        id,
        organization_id,
        sku,
        name,
        manufacturer
      )
    `);

  if (organizationId) {
    query = query.eq('products.organization_id', organizationId);
  }

  if (productIds && productIds.length > 0) {
    query = query.in('product_id', productIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch product embeddings: ${error.message}`);
  }

  return data || [];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: corsHeaders() 
      }
    );
  }

  try {
    // GET request: retrieve existing embeddings
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const organizationId = url.searchParams.get('organization_id');
      const productIds = url.searchParams.getAll('product_id');

      const embeddings = await getProductEmbeddings(
        organizationId || undefined, 
        productIds.length > 0 ? productIds : undefined
      );

      return new Response(
        JSON.stringify({
          success: true,
          data: embeddings,
        }),
        { 
          status: 200,
          headers: corsHeaders() 
        }
      );
    }

    // POST request: generate new embeddings
    const embeddingRequest: EmbeddingRequest = await req.json();
    const result = await processEmbeddingRequest(embeddingRequest);

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400,
        headers: corsHeaders() 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: corsHeaders() 
      }
    );
  }
});