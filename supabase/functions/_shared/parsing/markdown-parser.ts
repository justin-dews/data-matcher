// Markdown table parsing module (legacy support)

import type { Table, TableRow, LineItem } from './types.ts';
import { LEGACY_COLUMN_PATTERNS, findColumnIndex } from './column-patterns.ts';
import { parseNumber, isDataRow, isHeaderRow } from './line-item-extractor.ts';

// Markdown table parsing
export function parseMarkdownTables(markdownText: string): { tables: Table[], totalLineItems: number } {
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

// Line item extraction from markdown tables
export function extractLineItemsFromMarkdownTables(tables: Table[]): LineItem[] {
  const allItems: LineItem[] = [];
  let globalPosition = 1;
  
  for (const table of tables) {
    console.log(`Processing table with ${table.rows.length} rows`);
    console.log(`Table headers: [${table.headers.join(' | ')}]`);
    
    // Debug: Show processed headers for matching
    const processedHeaders = table.headers.map((h, i) => `${i}: "${h}" -> "${h.toLowerCase().replace(/[^a-z0-9]/g, '')}"`);  
    console.log(`Processed headers: [${processedHeaders.join(' | ')}]`);
    
    // Find column indices, ensuring no overlap
    const itemIndex = findColumnIndex(table.headers, LEGACY_COLUMN_PATTERNS.item);
    console.log(`Item column index: ${itemIndex} (patterns: ${LEGACY_COLUMN_PATTERNS.item.join(', ')})`);
    const partIndex = findColumnIndex(table.headers, LEGACY_COLUMN_PATTERNS.part, [itemIndex]);
    const descIndex = findColumnIndex(table.headers, LEGACY_COLUMN_PATTERNS.description, [itemIndex, partIndex]);
    const qtyIndex = findColumnIndex(table.headers, LEGACY_COLUMN_PATTERNS.quantity, [itemIndex, partIndex, descIndex]);
    const priceIndex = findColumnIndex(table.headers, LEGACY_COLUMN_PATTERNS.price, [itemIndex, partIndex, descIndex, qtyIndex]);
    const totalIndex = findColumnIndex(table.headers, LEGACY_COLUMN_PATTERNS.total, [itemIndex, partIndex, descIndex, qtyIndex, priceIndex]);
    const uomIndex = findColumnIndex(table.headers, LEGACY_COLUMN_PATTERNS.uom, [itemIndex, partIndex, descIndex, qtyIndex, priceIndex, totalIndex]);
    
    console.log(`Column mapping: item=${itemIndex}, part=${partIndex}, desc=${descIndex}, qty=${qtyIndex}, price=${priceIndex}, total=${totalIndex}, uom=${uomIndex}`);
    
    // Process each row
    for (const row of table.rows) {
      console.log(`Checking row: [${row.cells.join(' | ')}]`);
      
      if (!isDataRow(row.cells)) {
        console.log(`Skipping non-data row: ${row.cells[0]} - reason: ${isHeaderRow(row.cells) ? 'header' : 'other'}`);
        continue;
      }
      
      console.log(`Processing data row: ${row.cells[0]}`);
      
      // Smart item number extraction using complex logic from original
      const finalItemNumber = extractSmartItemNumber(
        row.cells, itemIndex, partIndex, descIndex, qtyIndex, priceIndex, totalIndex, uomIndex, table.headers
      );

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

// Complex smart item number extraction logic (preserved from original)
function extractSmartItemNumber(
  cells: string[], 
  itemIndex: number, 
  partIndex: number, 
  descIndex: number,
  qtyIndex: number,
  priceIndex: number,
  totalIndex: number,
  uomIndex: number,
  headers: string[]
): string {
  let finalItemNumber = '';
  
  // First try: use the designated item column if found and not empty
  if (itemIndex >= 0 && cells[itemIndex] && cells[itemIndex].trim()) {
    const candidateValue = cells[itemIndex].trim();
    // Only use if it doesn't look like a sequential line number
    if (!/^\d+$/.test(candidateValue) || candidateValue.length > 3) {
      finalItemNumber = candidateValue;
    }
  }
  
  // Second try: if still no item number, scan ALL columns for product-like identifiers
  if (!finalItemNumber) {
    console.log(`No item number found in designated column, scanning all columns for row: [${cells.join(' | ')}]`);
    
    for (let i = 0; i < cells.length; i++) {
      const cellValue = cells[i]?.trim();
      if (!cellValue) continue;
      
      // Skip columns already used for other purposes (but still check if they might have better product IDs)
      const isUsedColumn = i === descIndex || i === qtyIndex || i === priceIndex || i === totalIndex || i === uomIndex;
      
      // Enhanced product identifier patterns - much more permissive
      const isProductLike = (
        // Contains letters and numbers (most product codes)
        (/[A-Za-z]/.test(cellValue) && /[0-9]/.test(cellValue)) ||
        // All letters with reasonable length (model names)
        (/^[A-Za-z][A-Za-z\-\.\_%]{1,20}$/.test(cellValue)) ||
        // Numbers with dashes/dots (part numbers)
        (/^[0-9][0-9\-\.]{2,15}$/.test(cellValue)) ||
        // Mixed alphanumeric with common separators
        (/^[A-Za-z0-9][A-Za-z0-9\-\.\_%\s]{1,25}$/.test(cellValue))
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
  if (!finalItemNumber && partIndex >= 0 && cells[partIndex]) {
    finalItemNumber = cells[partIndex].trim();
    console.log(`Using part number as item identifier: "${finalItemNumber}"`);
  }
  
  // Fourth try: Special handling for "Product Description" columns that contain the actual product identifier
  if (!finalItemNumber && descIndex >= 0 && cells[descIndex]) {
    const descriptionValue = cells[descIndex].trim();
    
    // Check if the description column header suggests it contains product codes
    const descHeader = headers[descIndex]?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    const isProductDescriptionColumn = descHeader.includes('productdescription') || descHeader.includes('productdesc');
    
    console.log(`Checking description column for product identifier. Header: "${headers[descIndex]}", isProductDescription: ${isProductDescriptionColumn}`);
    
    if (isProductDescriptionColumn || (!itemIndex || itemIndex < 0)) {
      // In tables without a Product Code column, use the full description as the product identifier
      finalItemNumber = descriptionValue;
      console.log(`Using description as product identifier: "${finalItemNumber}"`);
    }
  }

  return finalItemNumber;
}