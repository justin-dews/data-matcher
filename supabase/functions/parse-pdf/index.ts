// Refactored PDF parsing edge function - dramatically simplified and modular

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { parseDocumentWithFormatting } from '../_shared/services/pdf-parsing-service.ts';
import { handleCORSPreflight, createCORSResponse, createErrorResponse } from '../_shared/utils/cors.ts';
import { createLogger } from '../_shared/utils/logging.ts';

const logger = createLogger('ParsePDFFunction');

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCORSPreflight();
  }

  try {
    logger.info('PDF parsing request received');
    
    const { storagePath } = await req.json();
    
    if (!storagePath) {
      throw new Error('Storage path is required');
    }

    logger.info('Processing document', { storagePath });

    // Use the modular parsing service
    const result = await parseDocumentWithFormatting(storagePath);

    logger.info('PDF parsing completed successfully', {
      totalItems: result.lineItems.length,
      parsingMethod: result.metadata.parsing_method,
      tableCount: result.metadata.total_tables
    });

    return createCORSResponse(result);

  } catch (error) {
    logger.error('Error in parse-pdf function', error as Error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return createErrorResponse(errorMessage);
  }
});