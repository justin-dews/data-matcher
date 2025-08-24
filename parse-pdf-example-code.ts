import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Interfaces
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

// Markdown table parsing
function parseMarkdownTables(markdownText: string): { tables: Table[], totalLineItems: number } {
  const lines = markdownText.split('\n');
  const tables: Table[] = [];
  let currentTable: Table | null = null;
  
  console.log(`Parsing markdown with ${lines.length} lines`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      if (currentTable) {
        tables.push(currentTable);
        console.log(`Closed table with ${currentTable.rows.length} rows`);
        currentTable = null;
      }
      continue;
    }
    
    // Detect table rows (lines with | separators)
    if (line.includes('|') && !line.match(/^\|[\s\-\|:]+\|$/)) {
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
      
      if (cells.length >= 3) { // Must have at least 3 columns for line items
        if (!currentTable) {
          // Start new table
          currentTable = {
            headers: cells,
            rows: [],
            startLine: i + 1,
            endLine: i + 1
          };
          console.log(`Started new table with headers: [${cells.join(', ')}]`);
        } else {
          // Add row to existing table
          currentTable.rows.push({
            cells,
            lineNumber: i + 1
          });
          currentTable.endLine = i + 1;
        }
      }
    }
    // Table separator line - continue
    else if (line.match(/^\|[\s\-\|:]+\|$/)) {
      continue;
    }
    // End of table
    else if (currentTable) {
      tables.push(currentTable);
      console.log(`Closed table with ${currentTable.rows.length} rows`);
      currentTable = null;
    }
  }
  
  // Close any remaining table
  if (currentTable) {
    tables.push(currentTable);
    console.log(`Closed final table with ${currentTable.rows.length} rows`);
  }
  
  const totalLineItems = tables.reduce((sum, table) => sum + table.rows.length, 0);
  console.log(`Found ${tables.length} tables with ${totalLineItems} total rows`);
  
  return { tables, totalLineItems };
}

// Line item extraction
function extractLineItemsFromTables(tables: Table[]): LineItem[] {
  const allItems: LineItem[] = [];
  let globalPosition = 1;
  
  // Column patterns to look for (case insensitive)
  const COLUMN_PATTERNS = {
    item: ['line item', 'lineitem', 'item', 'no', '#', 'line'],
    part: ['part', 'product', 'sku', 'code'],
    description: ['description', 'desc', 'name', 'product'],
    quantity: ['qty', 'quantity', 'amount'],
    price: ['price', 'rate', 'cost', 'unit'],
    total: ['total', 'amount', 'sum', 'ext'],
    uom: ['uom', 'unit', 'ea', 'each']
  };

  function findColumnIndex(headers: string[], patterns: string[], excludeIndices: number[] = []): number {
    for (let i = 0; i < headers.length; i++) {
      if (excludeIndices.includes(i)) continue;
      const header = headers[i].toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const pattern of patterns) {
        if (header.includes(pattern)) {
          return i;
        }
      }
    }
    return -1;
  }

  function parseNumber(value: string): number | null {
    if (!value || typeof value !== 'string') return null;
    
    // Remove currency symbols and formatting
    const cleaned = value.replace(/[$£€¥₹,\s]/g, '');
    const number = parseFloat(cleaned);
    
    return isNaN(number) ? null : number;
  }

  function isHeaderRow(cells: string[]): boolean {
    // Only skip the very first row if it's clearly a header
    const headerText = cells.join(' ').toLowerCase();
    return headerText.includes('item no') && headerText.includes('description') && headerText.includes('qty');
  }

  function isDataRow(cells: string[]): boolean {
    // Very permissive - only skip truly empty rows or obvious separators
    if (cells.every(cell => !cell || cell.trim() === '')) return false;
    if (cells[0]?.includes('---')) return false;
    
    // Process everything else, including what might be headers
    return true;
  }
  
  for (const table of tables) {
    console.log(`Processing table with ${table.rows.length} rows`);
    
    // Find column indices, ensuring no overlap
    const itemIndex = findColumnIndex(table.headers, COLUMN_PATTERNS.item);
    const partIndex = findColumnIndex(table.headers, COLUMN_PATTERNS.part, [itemIndex]);
    const descIndex = findColumnIndex(table.headers, COLUMN_PATTERNS.description, [itemIndex, partIndex]);
    const qtyIndex = findColumnIndex(table.headers, COLUMN_PATTERNS.quantity, [itemIndex, partIndex, descIndex]);
    const priceIndex = findColumnIndex(table.headers, COLUMN_PATTERNS.price, [itemIndex, partIndex, descIndex, qtyIndex]);
    const totalIndex = findColumnIndex(table.headers, COLUMN_PATTERNS.total, [itemIndex, partIndex, descIndex, qtyIndex, priceIndex]);
    const uomIndex = findColumnIndex(table.headers, COLUMN_PATTERNS.uom, [itemIndex, partIndex, descIndex, qtyIndex, priceIndex, totalIndex]);
    
    console.log(`Column mapping: item=${itemIndex}, part=${partIndex}, desc=${descIndex}, qty=${qtyIndex}, price=${priceIndex}`);
    
    // Process each row
    for (const row of table.rows) {
      console.log(`Checking row: [${row.cells.join(' | ')}]`);
      
      if (!isDataRow(row.cells)) {
        console.log(`Skipping non-data row: ${row.cells[0]} - reason: ${isHeaderRow(row.cells) ? 'header' : 'other'}`);
        continue;
      }
      
      console.log(`Processing data row: ${row.cells[0]}`);
      
      const item: LineItem = {
        id: crypto.randomUUID(),
        item_number: itemIndex >= 0 ? (row.cells[itemIndex] || globalPosition.toString()) : globalPosition.toString(),
        part_number: partIndex >= 0 ? (row.cells[partIndex] || '') : '',
        description: descIndex >= 0 ? (row.cells[descIndex] || '') : row.cells.join(' '),
        quantity: qtyIndex >= 0 ? parseNumber(row.cells[qtyIndex]) : null,
        unit_price: priceIndex >= 0 ? parseNumber(row.cells[priceIndex]) : null,
        total: totalIndex >= 0 ? parseNumber(row.cells[totalIndex]) : null,
        uom: uomIndex >= 0 ? (row.cells[uomIndex] || '') : '',
        raw_row: row.cells.join(' | '),
        position: globalPosition,
        source_line: row.lineNumber
      };
      
      // Only add if we have meaningful data
      if (item.description || item.part_number) {
        allItems.push(item);
        globalPosition++;
        console.log(`Extracted item ${globalPosition - 1}: ${item.description || item.part_number}`);
      }
    }
  }
  
  console.log(`Total extracted line items: ${allItems.length}`);
  return allItems;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function downloadFileFromStorage(supabase: any, storagePath: string) {
  console.log('Downloading file from storage:', storagePath);
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

async function uploadToLlamaParse(fileData: Blob, llamaCloudApiKey: string) {
  const formData = new FormData();
  formData.append('file', fileData, 'document.pdf');
  formData.append('parsing_instruction', 'Extract line items, product descriptions, quantities, and prices from this invoice/quote document.');

  console.log('Uploading to LlamaParse API...');
  
  // Retry logic for network issues
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
      console.log('Upload result received:', uploadResult);

      const jobId = uploadResult.id;
      if (!jobId) {
        throw new Error('No job ID received from LlamaParse');
      }

      return jobId;
      
    } catch (error) {
      console.error(`Upload attempt ${attempt} failed:`, error.message);
      lastError = error;
      
      if (attempt < 3) {
        console.log(`Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  throw new Error(`LlamaParse upload failed after 3 attempts. Last error: ${lastError.message}`);
}

async function waitForParsingCompletion(jobId: string, llamaCloudApiKey: string) {
  console.log('Polling for job completion...');
  let attempts = 0;
  const maxAttempts = 30; // 5 minutes max
  
  while (attempts < maxAttempts) {
    const statusResponse = await fetch(`https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${llamaCloudApiKey}`,
      },
    });

    if (!statusResponse.ok) {
      console.error('Status check failed:', statusResponse.status);
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      continue;
    }

    const jobResult = await statusResponse.json();
    console.log(`Job status (attempt ${attempts + 1}):`, jobResult.status);

    if (jobResult.status === 'SUCCESS') {
      return jobResult;
    } else if (jobResult.status === 'ERROR') {
      throw new Error(`Parsing failed: ${jobResult.error || 'Unknown error'}`);
    }

    // Wait 10 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 10000));
    attempts++;
  }

  throw new Error('Parsing timed out or failed to complete');
}

async function fetchParsingResults(jobId: string, llamaCloudApiKey: string) {
  console.log('Fetching markdown result...');
  const markdownResponse = await fetch(`https://api.cloud.llamaindex.ai/api/v1/parsing/job/${jobId}/result/markdown`, {
    headers: {
      'Authorization': `Bearer ${llamaCloudApiKey}`,
    },
  });

  if (!markdownResponse.ok) {
    throw new Error('Failed to fetch markdown results');
  }

  const rawData = await markdownResponse.text();
  console.log('Raw result length:', rawData?.length);
  console.log('Raw preview:', rawData?.substring(0, 200));

  // Parse the JSON response to extract the actual markdown
  let markdownData;
  try {
    const jsonData = JSON.parse(rawData);
    markdownData = jsonData.markdown || rawData;
  } catch (error) {
    markdownData = rawData;
  }

  return markdownData;
}

function formatLineItemsForResponse(lineItems: any[]) {
  return lineItems.map((item: any, index: number) => ({
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
  }));
}

serve(async (req: any) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting PDF parsing request');
    
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

    // Download file from Supabase storage
    const fileData = await downloadFileFromStorage(supabase, storagePath);

    // Upload to LlamaParse
    const jobId = await uploadToLlamaParse(fileData, llamaCloudApiKey);

    // Wait for completion
    await waitForParsingCompletion(jobId, llamaCloudApiKey);

    // Get markdown results
    const markdownData = await fetchParsingResults(jobId, llamaCloudApiKey);

    // Parse tables from markdown
    const { tables, totalLineItems } = parseMarkdownTables(markdownData);
    console.log(`Found ${tables.length} tables with ${totalLineItems} rows`);

    // Extract line items from tables
    const lineItems = extractLineItemsFromTables(tables);
    console.log(`Final extracted line items: ${lineItems.length}`);

    // Format response
    const formattedLineItems = formatLineItemsForResponse(lineItems);

    return new Response(
      JSON.stringify({
        success: true,
        lineItems: formattedLineItems,
        metadata: {
          total_items: lineItems.length,
          total_tables: tables.length,
          parse_time: new Date().toISOString(),
          parsing_method: 'markdown_tables'
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in parse-pdf function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});