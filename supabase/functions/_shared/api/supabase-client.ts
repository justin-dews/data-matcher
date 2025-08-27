// Supabase client with streaming file operations

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface SupabaseStorageClient {
  downloadFile(storagePath: string): Promise<Blob>;
}

export class StreamingSupabaseClient implements SupabaseStorageClient {
  private client: any;

  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey);
  }

  async downloadFile(storagePath: string): Promise<Blob> {
    console.log('Downloading file from storage:', storagePath);
    
    const { data: fileData, error: downloadError } = await this.client.storage
      .from('documents')
      .download(storagePath);

    if (downloadError) {
      console.error('Error downloading file:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    console.log('File downloaded successfully, size:', fileData.size);
    return fileData;
  }
}

export function createSupabaseClient(url: string, serviceKey: string): SupabaseStorageClient {
  return new StreamingSupabaseClient(url, serviceKey);
}