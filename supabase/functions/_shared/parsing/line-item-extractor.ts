// Line item extraction utilities

import type { LineItem, ColumnMapping } from './types.ts';

// Extract line item data from a row (HTML table format)
export function extractLineItemFromRow(
  row: string[], 
  columnMapping: ColumnMapping, 
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

// Parse numeric values with currency symbols
export function parsePrice(value: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// Parse quantity values
export function parseQuantity(value: string): number | null {
  if (!value) return null;
  const parsed = parseFloat(value.replace(/[,\s]/g, ''));
  return isNaN(parsed) ? null : parsed;
}

// Generic number parser
export function parseNumber(value: string): number | null {
  if (!value || typeof value !== 'string') return null;
  
  // Remove currency symbols and formatting
  const cleaned = value.replace(/[$£€¥₹,\s]/g, '');
  const number = parseFloat(cleaned);
  
  return isNaN(number) ? null : number;
}

// Row classification utilities
export function isHeaderRow(cells: string[]): boolean {
  // Only skip the very first row if it's clearly a header
  const headerText = cells.join(' ').toLowerCase();
  return headerText.includes('item no') && headerText.includes('description') && headerText.includes('qty');
}

export function isDataRow(cells: string[]): boolean {
  // Very permissive - only skip truly empty rows or obvious separators
  if (cells.every(cell => !cell || cell.trim() === '')) return false;
  if (cells[0]?.includes('---')) return false;
  
  // Process everything else, including what might be headers
  return true;
}

// Format line items for API response
export function formatLineItemsForResponse(lineItems: LineItem[]) {
  return lineItems.map((item: LineItem, index: number) => ({
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