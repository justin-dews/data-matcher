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

// Enhanced HTML Table Parser for LlamaParse Output
interface ExtractedTable {
  headers: string[];
  rows: string[][];
  tableType: 'line_items' | 'metadata' | 'unknown';
  confidence: number;
}

// Advanced column mapping patterns - covers multiple naming conventions
const ADAPTIVE_COLUMN_PATTERNS = {
  // Item/SKU/Part Number patterns (highest priority)
  item_identifier: [
    /^item$/i, /^sku$/i, /^part[\s_-]?number$/i, /^part[\s_-]?num$/i, /^part$/i,
    /^product[\s_-]?code$/i, /^model$/i, /^model[\s_-]?number$/i,
    /^catalog[\s_-]?number$/i, /^catalog$/i, /^item[\s_-]?code$/i,
    /^product[\s_-]?id$/i, /^mfg[\s_-]?part$/i, /^manufacturer[\s_-]?part$/i
  ],
  
  // Description patterns
  description: [
    /^description$/i, /^product[\s_-]?description$/i, /^item[\s_-]?description$/i,
    /^product[\s_-]?name$/i, /^name$/i, /^title$/i, /^details$/i,
    /^spec$/i, /^specification$/i
  ],
  
  // Quantity patterns  
  quantity: [
    /^qty$/i, /^quantity$/i, /^quan$/i, /^amount$/i, /^count$/i,
    /^ordered$/i, /^order[\s_-]?qty$/i, /^ship[\s_-]?qty$/i
  ],
  
  // Unit price patterns
  unit_price: [
    /^unit[\s_-]?price$/i, /^price$/i, /^cost$/i, /^rate$/i,
    /^unit[\s_-]?cost$/i, /^each$/i, /^per[\s_-]?unit$/i,
    /^list[\s_-]?price$/i, /^selling[\s_-]?price$/i
  ],
  
  // Total/Extended price patterns
  total_price: [
    /^total$/i, /^amount$/i, /^extended$/i, /^extended[\s_-]?price$/i,
    /^line[\s_-]?total$/i, /^subtotal$/i, /^net[\s_-]?amount$/i
  ],
  
  // Unit of measure patterns
  uom: [
    /^u[\/\s_-]?m$/i, /^unit$/i, /^units$/i, /^uom$/i, /^each$/i, /^ea$/i
  ]
};

// Parse HTML tables from markdown content
function parseHTMLTables(markdownText: string): ExtractedTable[] {
  const tables: ExtractedTable[] = [];
  
  // Find all HTML table structures
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  const tableMatches = markdownText.match(tableRegex);
  
  if (!tableMatches) {
    console.log('No HTML tables found in markdown');
    return tables;
  }
  
  console.log(`Found ${tableMatches.length} HTML tables`);
  
  for (let i = 0; i < tableMatches.length; i++) {
    const tableHTML = tableMatches[i];
    
    try {
      const extractedTable = parseIndividualHTMLTable(tableHTML, i + 1);
      if (extractedTable) {
        tables.push(extractedTable);
      }
    } catch (error) {
      console.error(`Error parsing table ${i + 1}:`, error);
    }
  }
  
  return tables;
}

// Parse individual HTML table
function parseIndividualHTMLTable(tableHTML: string, tableIndex: number): ExtractedTable | null {
  // Extract headers from <thead> or first <tr>
  const headers = extractTableHeaders(tableHTML);
  
  // Extract data rows from <tbody> or all <tr> except header
  const rows = extractTableRows(tableHTML, headers.length);
  
  if (headers.length === 0 || rows.length === 0) {
    console.log(`Table ${tableIndex}: No valid headers or rows found`);
    return null;
  }
  
  // Determine table type and confidence
  const { tableType, confidence } = classifyTable(headers, rows);
  
  console.log(`Table ${tableIndex}: ${headers.length} headers, ${rows.length} rows, type: ${tableType}, confidence: ${confidence}`);
  
  return {
    headers,
    rows,
    tableType,
    confidence
  };
}

// Extract headers from HTML table
function extractTableHeaders(tableHTML: string): string[] {
  // Try to find <thead> section first
  const theadMatch = tableHTML.match(/<thead[\s\S]*?<\/thead>/i);
  let headerSection = theadMatch ? theadMatch[0] : '';
  
  // If no <thead>, use first <tr>
  if (!headerSection) {
    const firstTrMatch = tableHTML.match(/<tr[\s\S]*?<\/tr>/i);
    headerSection = firstTrMatch ? firstTrMatch[0] : '';
  }
  
  if (!headerSection) return [];
  
  // Extract all <th> or <td> content from header section
  const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
  const headers: string[] = [];
  let match;
  
  while ((match = cellRegex.exec(headerSection)) !== null) {
    const headerText = cleanCellText(match[1]);
    if (headerText) {
      headers.push(headerText);
    }
  }
  
  return headers;
}

// Extract data rows from HTML table
function extractTableRows(tableHTML: string, expectedColumns: number): string[][] {
  const rows: string[][] = [];
  
  // Get <tbody> section, or all content if no <tbody>
  const tbodyMatch = tableHTML.match(/<tbody[\s\S]*?<\/tbody>/i);
  const rowSection = tbodyMatch ? tbodyMatch[0] : tableHTML;
  
  // Find all <tr> elements
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const trMatches = rowSection.match(trRegex);
  
  if (!trMatches) return rows;
  
  // Skip first row if it looks like headers (and we got tbody)
  const startIndex = tbodyMatch ? 0 : 1;
  
  for (let i = startIndex; i < trMatches.length; i++) {
    const trContent = trMatches[i];
    
    // Skip rows that are just spanning headers or totals
    if (trContent.includes('colspan') && 
        (trContent.toLowerCase().includes('total') || 
         trContent.toLowerCase().includes('subtotal') ||
         trContent.toLowerCase().includes('shipping'))) {
      continue;
    }
    
    const cells = extractCellsFromRow(trContent);
    
    // Only include rows with reasonable number of cells
    if (cells.length >= Math.max(3, Math.floor(expectedColumns * 0.7))) {
      rows.push(cells);
    }
  }
  
  return rows;
}

// Extract cells from a table row
function extractCellsFromRow(rowHTML: string): string[] {
  const cells: string[] = [];
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let match;
  
  while ((match = cellRegex.exec(rowHTML)) !== null) {
    const cellText = cleanCellText(match[1]);
    cells.push(cellText);
  }
  
  return cells;
}

// Clean cell text content
function cleanCellText(cellHTML: string): string {
  // Remove HTML tags and decode entities
  let text = cellHTML
    .replace(/<br\s*\/?>/gi, ' ')  // Convert <br> to space
    .replace(/<[^>]*>/g, '')       // Remove all HTML tags
    .replace(/&nbsp;/gi, ' ')      // Convert &nbsp; to space
    .replace(/&amp;/gi, '&')       // Decode &amp;
    .replace(/&lt;/gi, '<')        // Decode &lt;
    .replace(/&gt;/gi, '>')        // Decode &gt;
    .trim();
    
  return text;
}

// Classify table type based on headers and content
function classifyTable(headers: string[], rows: string[][]): { tableType: 'line_items' | 'metadata' | 'unknown', confidence: number } {
  let lineItemScore = 0;
  let metadataScore = 0;
  
  // Check headers for line item indicators
  const headerText = headers.join(' ').toLowerCase();
  
  // Strong line item indicators
  if (headerText.includes('item') || headerText.includes('sku') || headerText.includes('part')) lineItemScore += 30;
  if (headerText.includes('description') || headerText.includes('product')) lineItemScore += 25;
  if (headerText.includes('quantity') || headerText.includes('qty')) lineItemScore += 25;
  if (headerText.includes('price') || headerText.includes('cost') || headerText.includes('amount')) lineItemScore += 20;
  
  // Strong metadata indicators
  if (headerText.includes('order') && headerText.includes('date')) metadataScore += 40;
  if (headerText.includes('customer') || headerText.includes('ship to') || headerText.includes('bill to')) metadataScore += 30;
  if (headerText.includes('payment') || headerText.includes('terms')) metadataScore += 25;
  
  // Row count factor (line item tables usually have multiple rows)
  if (rows.length >= 3) lineItemScore += 15;
  if (rows.length >= 5) lineItemScore += 10;
  if (rows.length === 1) metadataScore += 20;
  
  // Column count factor (line item tables usually have 4+ columns)
  if (headers.length >= 4) lineItemScore += 10;
  if (headers.length >= 6) lineItemScore += 5;
  
  const confidence = Math.min(100, Math.max(lineItemScore, metadataScore));
  
  if (lineItemScore > metadataScore && lineItemScore >= 30) {
    return { tableType: 'line_items', confidence: confidence / 100 };
  } else if (metadataScore > lineItemScore && metadataScore >= 30) {
    return { tableType: 'metadata', confidence: confidence / 100 };
  } else {
    return { tableType: 'unknown', confidence: confidence / 100 };
  }
}

// Map table headers to our field names
function mapColumnsToFields(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase().trim();
    
    // Check each pattern type
    for (const [fieldName, patterns] of Object.entries(ADAPTIVE_COLUMN_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(header))) {
        mapping[fieldName] = i;
        break; // Use first match (patterns are ordered by priority)
      }
    }
  }
  
  return mapping;
}

// Extract line item data from a row
function extractLineItemFromRow(
  row: string[], 
  columnMapping: Record<string, number>, 
  position: number, 
  sourceLineNumber: number
): LineItem | null {
  
  const getValue = (fieldName: string): string => {
    const colIndex = columnMapping[fieldName];
    return (colIndex !== undefined && row[colIndex]) ? row[colIndex].trim() : '';
  };
  
  const itemId = getValue('item_identifier');
  const description = getValue('description');
  
  // Must have either item ID or description
  if (!itemId && !description) {
    return null;
  }
  
  // Parse numeric values
  const parsePrice = (value: string): number | null => {
    if (!value) return null;
    const cleaned = value.replace(/[$,\s]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };
  
  const parseQuantity = (value: string): number | null => {
    if (!value) return null;
    const parsed = parseFloat(value.replace(/[,\s]/g, ''));
    return isNaN(parsed) ? null : parsed;
  };
  
  return {
    id: crypto.randomUUID(),
    item_number: itemId || `ITEM-${position}`,
    part_number: itemId || `PART-${position}`,
    description: description || itemId || `Unknown Item ${position}`,
    quantity: parseQuantity(getValue('quantity')),
    unit_price: parsePrice(getValue('unit_price')),
    total: parsePrice(getValue('total_price')),
    uom: getValue('uom') || 'EA',
    raw_row: row.join(' | '),
    position: position,
    source_line: sourceLineNumber + 1
  };
}

// Convert extracted tables to line items
function convertTablesToLineItems(tables: ExtractedTable[]): LineItem[] {
  const allLineItems: LineItem[] = [];
  let globalPosition = 1;
  
  // Sort tables by line item confidence (highest first)
  const lineItemTables = tables
    .filter(table => table.tableType === 'line_items')
    .sort((a, b) => b.confidence - a.confidence);
  
  console.log(`Processing ${lineItemTables.length} line item tables`);
  
  for (const table of lineItemTables) {
    const columnMapping = mapColumnsToFields(table.headers);
    console.log(`Column mapping for table:`, columnMapping);
    
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
      const row = table.rows[rowIndex];
      const lineItem = extractLineItemFromRow(row, columnMapping, globalPosition, rowIndex);
      
      if (lineItem) {
        allLineItems.push(lineItem);
        globalPosition++;
      }
    }
  }
  
  console.log(`Extracted ${allLineItems.length} line items total`);
  return allLineItems;
}

// Main parsing function that handles both HTML and markdown
function parseAdaptiveTableFormat(content: string): LineItem[] {
  console.log('Starting adaptive table parsing...');
  
  // Check if content contains HTML tables
  if (content.includes('<table') && content.includes('</table>')) {
    console.log('Detected HTML table format');
    const htmlTables = parseHTMLTables(content);
    return convertTablesToLineItems(htmlTables);
  }
  
  // Fallback to existing markdown parsing
  console.log('No HTML tables detected, using existing markdown parser');
  const { tables } = parseMarkdownTables(content);
  return extractLineItemsFromTables(tables);
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
  
  // Column patterns to look for (case insensitive) - ordered by priority
  const COLUMN_PATTERNS = {
    // Item/Product identifiers - highest priority patterns first
    item: [
      'productcode',     // exact match for "Product Code" -> "productcode"
      'product code',    // handle spaces
      'itemcode',        // "Item Code" -> "itemcode"  
      'item code',
      'sku',            // stock keeping unit
      'partnumber',     // "Part Number" -> "partnumber"
      'part number',
      'partno',         // "Part No" -> "partno"
      'part no',
      'itemid',         // "Item ID" -> "itemid"
      'item id',
      'itemno',         // "Item No" -> "itemno" 
      'item no',
      'itemnumber',     // "Item Number" -> "itemnumber"
      'item number',
      'modelno',        // "Model No" -> "modelno"
      'model no',
      'modelnumber',    // "Model Number" -> "modelnumber"
      'model number',
      'code'            // generic "Code"
    ],
    // Secondary part identifiers (for when item column is found)
    part: ['part', 'component', 'material'],
    // Description patterns - avoid conflicts with item patterns
    description: ['description', 'desc', 'name', 'details', 'specification'],
    // Other columns
    quantity: ['qty', 'quantity', 'amount', 'count'],
    price: ['price', 'rate', 'cost', 'unit'],
    total: ['total', 'amount', 'sum', 'ext', 'value'],
    uom: ['uom', 'unit', 'ea', 'each', 'units']
  };

  function findColumnIndex(headers: string[], patterns: string[], excludeIndices: number[] = []): number {
    for (let i = 0; i < headers.length; i++) {
      if (excludeIndices.includes(i)) continue;
      const header = headers[i].toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const pattern of patterns) {
        const cleanPattern = pattern.replace(/[^a-z0-9]/g, '');
        // Use exact match for more precise matching
        if (header === cleanPattern) {
          console.log(`Exact column match: "${headers[i]}" (processed: "${header}") matched pattern "${pattern}" at index ${i}`);
          return i;
        }
      }
    }
    // Fallback to includes matching if no exact match
    for (let i = 0; i < headers.length; i++) {
      if (excludeIndices.includes(i)) continue;
      const header = headers[i].toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const pattern of patterns) {
        const cleanPattern = pattern.replace(/[^a-z0-9]/g, '');
        if (header.includes(cleanPattern)) {
          console.log(`Partial column match: "${headers[i]}" (processed: "${header}") matched pattern "${pattern}" at index ${i}`);
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
    console.log(`Table headers: [${table.headers.join(' | ')}]`);
    
    // Debug: Show processed headers for matching
    const processedHeaders = table.headers.map((h, i) => `${i}: "${h}" -> "${h.toLowerCase().replace(/[^a-z0-9]/g, '')}"`);
    console.log(`Processed headers: [${processedHeaders.join(' | ')}]`);
    
    // Find column indices, ensuring no overlap
    const itemIndex = findColumnIndex(table.headers, COLUMN_PATTERNS.item);
    console.log(`Item column index: ${itemIndex} (patterns: ${COLUMN_PATTERNS.item.join(', ')})`);
    const partIndex = findColumnIndex(table.headers, COLUMN_PATTERNS.part, [itemIndex]);
    const descIndex = findColumnIndex(table.headers, COLUMN_PATTERNS.description, [itemIndex, partIndex]);
    const qtyIndex = findColumnIndex(table.headers, COLUMN_PATTERNS.quantity, [itemIndex, partIndex, descIndex]);
    const priceIndex = findColumnIndex(table.headers, COLUMN_PATTERNS.price, [itemIndex, partIndex, descIndex, qtyIndex]);
    const totalIndex = findColumnIndex(table.headers, COLUMN_PATTERNS.total, [itemIndex, partIndex, descIndex, qtyIndex, priceIndex]);
    const uomIndex = findColumnIndex(table.headers, COLUMN_PATTERNS.uom, [itemIndex, partIndex, descIndex, qtyIndex, priceIndex, totalIndex]);
    
    console.log(`Column mapping: item=${itemIndex}, part=${partIndex}, desc=${descIndex}, qty=${qtyIndex}, price=${priceIndex}, total=${totalIndex}, uom=${uomIndex}`);
    
    // Process each row
    for (const row of table.rows) {
      console.log(`Checking row: [${row.cells.join(' | ')}]`);
      
      if (!isDataRow(row.cells)) {
        console.log(`Skipping non-data row: ${row.cells[0]} - reason: ${isHeaderRow(row.cells) ? 'header' : 'other'}`);
        continue;
      }
      
      console.log(`Processing data row: ${row.cells[0]}`);
      
      // Smart item number extraction
      let finalItemNumber = '';
      
      // First try: use the designated item column if found and not empty
      if (itemIndex >= 0 && row.cells[itemIndex] && row.cells[itemIndex].trim()) {
        const candidateValue = row.cells[itemIndex].trim();
        // Only use if it doesn't look like a sequential line number
        if (!/^\d+$/.test(candidateValue) || candidateValue.length > 3) {
          finalItemNumber = candidateValue;
        }
      }
      
      // Second try: if still no item number, scan ALL columns for product-like identifiers
      if (!finalItemNumber) {
        console.log(`No item number found in designated column, scanning all columns for row: [${row.cells.join(' | ')}]`);
        
        for (let i = 0; i < row.cells.length; i++) {
          const cellValue = row.cells[i]?.trim();
          if (!cellValue) continue;
          
          // Skip columns already used for other purposes (but still check if they might have better product IDs)
          const isUsedColumn = i === descIndex || i === qtyIndex || i === priceIndex || i === totalIndex || i === uomIndex;
          
          // Enhanced product identifier patterns - much more permissive
          const isProductLike = (
            // Contains letters and numbers (most product codes)
            (/[A-Za-z]/.test(cellValue) && /[0-9]/.test(cellValue)) ||
            // All letters with reasonable length (model names)
            (/^[A-Za-z][A-Za-z\-\.\_]{1,20}$/.test(cellValue)) ||
            // Numbers with dashes/dots (part numbers)
            (/^[0-9][0-9\-\.]{2,15}$/.test(cellValue)) ||
            // Mixed alphanumeric with common separators
            (/^[A-Za-z0-9][A-Za-z0-9\-\.\_\s]{1,25}$/.test(cellValue))
          );
          
          // Additional checks for product-like characteristics
          const hasReasonableLength = cellValue.length >= 2 && cellValue.length <= 30;
          const notObviouslyQuantity = !(/^\d+\.?\d*$/.test(cellValue) && parseFloat(cellValue) < 1000);
          const notObviouslyPrice = !(/^\$?\d+\.?\d{0,2}$/.test(cellValue));
          const notObviouslyDescription = cellValue.split(' ').length < 4; // Descriptions usually have multiple words
          
          if (isProductLike && hasReasonableLength && notObviouslyQuantity && notObviouslyPrice && notObviouslyDescription) {
            // Prioritize non-used columns, but accept used columns if nothing else found
            if (!isUsedColumn || !finalItemNumber) {
              console.log(`Found potential product identifier: "${cellValue}" in column ${i} (used: ${isUsedColumn})`);
              finalItemNumber = cellValue;
              if (!isUsedColumn) break; // Stop if we found one in an unused column
            }
          }
        }
      }
      
      // Third try: if still no item number, try the part_number field as a last resort
      if (!finalItemNumber && partIndex >= 0 && row.cells[partIndex]) {
        finalItemNumber = row.cells[partIndex].trim();
        console.log(`Using part number as item identifier: "${finalItemNumber}"`);
      }
      
      // Fourth try: Special handling for "Product Description" columns that contain the actual product identifier
      // This handles cases where the table structure is: Line Item | Quantity | Product Description | Unit Price | Total Price
      if (!finalItemNumber && descIndex >= 0 && row.cells[descIndex]) {
        const descriptionValue = row.cells[descIndex].trim();
        
        // Check if the description column header suggests it contains product codes
        const descHeader = table.headers[descIndex]?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
        const isProductDescriptionColumn = descHeader.includes('productdescription') || descHeader.includes('productdesc');
        
        console.log(`Checking description column for product identifier. Header: "${table.headers[descIndex]}", isProductDescription: ${isProductDescriptionColumn}`);
        
        if (isProductDescriptionColumn || (!itemIndex || itemIndex < 0)) {
          // In tables without a Product Code column, use the full description as the product identifier
          // This handles cases like "GR. 8 HX HD CAP SCR 3/8-24X1-1/4" which ARE the product identifiers
          finalItemNumber = descriptionValue;
          console.log(`Using description as product identifier: "${finalItemNumber}"`);
        }
      }

      const item: LineItem = {
        id: crypto.randomUUID(),
        item_number: finalItemNumber || globalPosition.toString(),
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
  formData.append('parse_mode', 'parse_page_with_agent');
  formData.append('adaptive_long_table', 'true');
  formData.append('outlined_table_extraction', 'true');
  formData.append('high_res_ocr', 'true');
  formData.append('model', 'anthropic-sonnet-4.0');
  formData.append('output_tables_as_HTML', 'true');

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

    // Use adaptive parsing (HTML tables or markdown tables)
    const lineItems = parseAdaptiveTableFormat(markdownData);
    console.log(`Final extracted line items using adaptive parser: ${lineItems.length}`);
    
    // Determine parsing method used
    const usedHtmlTables = markdownData.includes('<table') && markdownData.includes('</table>');
    const parsingMethod = usedHtmlTables ? 'html_tables' : 'markdown_tables';
    
    // Count tables for metadata
    let tableCount = 0;
    if (usedHtmlTables) {
      const tableMatches = markdownData.match(/<table[\s\S]*?<\/table>/gi);
      tableCount = tableMatches ? tableMatches.length : 0;
    } else {
      const { tables } = parseMarkdownTables(markdownData);
      tableCount = tables.length;
    }

    // Format response
    const formattedLineItems = formatLineItemsForResponse(lineItems);

    return new Response(
      JSON.stringify({
        success: true,
        lineItems: formattedLineItems,
        metadata: {
          total_items: lineItems.length,
          total_tables: tableCount,
          parse_time: new Date().toISOString(),
          parsing_method: parsingMethod
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in parse-pdf function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});