// LlamaParse API client with streaming support

import {
  resilientLlamaParseUpload,
  resilientLlamaParseJobStatus,
  resilientLlamaParseResults,
  ResilientAPIError,
  ErrorType
} from '../resilient-apis.ts';

export interface LlamaParseClient {
  uploadDocument(fileData: Blob): Promise<string>;
  waitForCompletion(jobId: string): Promise<void>;
  getResults(jobId: string): Promise<string>;
}

export class StreamingLlamaParseClient implements LlamaParseClient {
  constructor(private apiKey: string) {}

  async uploadDocument(fileData: Blob): Promise<string> {
    console.log('Uploading to LlamaParse API with resilient patterns...');
    
    try {
      const uploadResult = await resilientLlamaParseUpload(fileData, this.apiKey);
      
      const jobId = uploadResult.id;
      if (!jobId) {
        throw new Error('No job ID received from LlamaParse');
      }

      console.log('Upload successful, job ID:', jobId);
      return jobId;
      
    } catch (error) {
      throw this.handleAPIError(error, 'upload');
    }
  }

  async waitForCompletion(jobId: string): Promise<void> {
    console.log('Polling for job completion with resilient patterns...');
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max
    
    while (attempts < maxAttempts) {
      try {
        const jobResult = await resilientLlamaParseJobStatus(jobId, this.apiKey);
        console.log(`Job status (attempt ${attempts + 1}):`, jobResult.status);

        if (jobResult.status === 'SUCCESS') {
          return;
        } else if (jobResult.status === 'ERROR') {
          throw new Error(`Parsing failed: ${jobResult.error || 'Unknown error'}`);
        }

        // Wait 10 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 10000));
        attempts++;
        
      } catch (error) {
        if (this.isPermanentError(error)) {
          throw error;
        }
        
        // For temporary errors, wait and continue
        console.log('Status check failed but retrying...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
    }

    throw new Error('Parsing timed out or failed to complete after all retry attempts');
  }

  async getResults(jobId: string): Promise<string> {
    console.log('Fetching markdown result with resilient patterns...');
    
    try {
      const result = await resilientLlamaParseResults(jobId, this.apiKey);
      const markdownData = result.markdown;
      
      console.log('Markdown result length:', markdownData?.length);
      console.log('Markdown preview:', markdownData?.substring(0, 200));

      return markdownData;
      
    } catch (error) {
      throw this.handleAPIError(error, 'fetch results');
    }
  }

  private isPermanentError(error: unknown): boolean {
    if (error instanceof Error) {
      const resilientError = error as ResilientAPIError;
      return resilientError.type === ErrorType.AUTHENTICATION || 
             resilientError.type === ErrorType.PERMANENT;
    }
    return false;
  }

  private handleAPIError(error: unknown, operation: string): Error {
    if (error instanceof Error) {
      const resilientError = error as ResilientAPIError;
      console.error(`LlamaParse ${operation} failed: ${resilientError.type} - ${resilientError.message}`);
      
      // Provide specific error messaging based on error type
      switch (resilientError.type) {
        case ErrorType.RATE_LIMIT:
          return new Error(`LlamaParse rate limit exceeded. Please try again later.`);
        case ErrorType.AUTHENTICATION:
          return new Error(`LlamaParse authentication failed. Please check your API key.`);
        case ErrorType.TIMEOUT:
          return new Error(`LlamaParse ${operation} timed out. The document may be too large or complex.`);
        case ErrorType.NETWORK:
          return new Error(`Network error connecting to LlamaParse. Please check your connection.`);
        default:
          return new Error(`LlamaParse ${operation} failed: ${resilientError.message}`);
      }
    }
    
    return error as Error;
  }
}

export function createLlamaParseClient(apiKey: string): LlamaParseClient {
  return new StreamingLlamaParseClient(apiKey);
}