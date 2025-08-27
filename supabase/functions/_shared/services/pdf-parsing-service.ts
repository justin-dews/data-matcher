// Main PDF parsing service - orchestrates the entire parsing pipeline

import type { ParsedContent } from '../parsing/types.ts';
import { parseAdaptiveTableFormat } from '../parsing/adaptive-parser.ts';
import { formatLineItemsForResponse } from '../parsing/line-item-extractor.ts';
import { createLlamaParseClient, type LlamaParseClient } from '../api/llamaparse-client.ts';
import { createSupabaseClient, type SupabaseStorageClient } from '../api/supabase-client.ts';
import { createLogger, type Logger } from '../utils/logging.ts';
import { validateEnvironment, type ParsePDFConfig } from '../utils/environment.ts';

export interface PDFParsingService {
  parseDocument(storagePath: string): Promise<ParsedContent>;
}

export class StreamingPDFParsingService implements PDFParsingService {
  private llamaClient: LlamaParseClient;
  private supabaseClient: SupabaseStorageClient;
  private logger: Logger;
  private config: ParsePDFConfig;

  constructor() {
    this.config = validateEnvironment();
    this.llamaClient = createLlamaParseClient(this.config.llamaCloudApiKey);
    this.supabaseClient = createSupabaseClient(this.config.supabaseUrl, this.config.supabaseServiceKey);
    this.logger = createLogger('PDFParsingService');
  }

  async parseDocument(storagePath: string): Promise<ParsedContent> {
    return this.logger.operation('parseDocument', async () => {
      this.logger.info('Starting PDF parsing pipeline', { storagePath });

      // Step 1: Download file from Supabase storage
      const fileData = await this.logger.operation('downloadFile', () => 
        this.supabaseClient.downloadFile(storagePath)
      );

      // Step 2: Upload to LlamaParse
      const jobId = await this.logger.operation('uploadToLlamaParse', () =>
        this.llamaClient.uploadDocument(fileData)
      );

      // Step 3: Wait for parsing completion
      await this.logger.operation('waitForCompletion', () =>
        this.llamaClient.waitForCompletion(jobId)
      );

      // Step 4: Get markdown results
      const markdownData = await this.logger.operation('getResults', () =>
        this.llamaClient.getResults(jobId)
      );

      // Step 5: Parse markdown content adaptively
      const parsedContent = await this.logger.operation('parseContent', () =>
        Promise.resolve(parseAdaptiveTableFormat(markdownData))
      );

      this.logger.info('PDF parsing pipeline completed successfully', {
        totalItems: parsedContent.lineItems.length,
        parsingMethod: parsedContent.metadata.parsing_method,
        tableCount: parsedContent.metadata.total_tables
      });

      return parsedContent;
    });
  }
}

// Factory function for dependency injection
export function createPDFParsingService(): PDFParsingService {
  return new StreamingPDFParsingService();
}

// Convenience function that formats the response
export async function parseDocumentWithFormatting(storagePath: string) {
  const service = createPDFParsingService();
  const parsedContent = await service.parseDocument(storagePath);
  
  return {
    success: true,
    lineItems: formatLineItemsForResponse(parsedContent.lineItems),
    metadata: parsedContent.metadata
  };
}