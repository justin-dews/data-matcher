// HTML table parsing module for LlamaParse output

import type { ExtractedTable, LineItem, ColumnMapping } from './types.ts';
import { mapColumnsToFields } from './column-patterns.ts';
import { extractLineItemFromRow } from './line-item-extractor.ts';

// Parse HTML tables from markdown content
export function parseHTMLTables(markdownText: string): ExtractedTable[] {
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

// Convert extracted HTML tables to line items
export function convertHTMLTablesToLineItems(tables: ExtractedTable[]): LineItem[] {
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