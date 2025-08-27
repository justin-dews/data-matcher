// Main adaptive parsing orchestrator

import type { LineItem, ParsedContent } from './types.ts';
import { parseHTMLTables, convertHTMLTablesToLineItems } from './html-parser.ts';
import { parseMarkdownTables, extractLineItemsFromMarkdownTables } from './markdown-parser.ts';

// Main parsing function that handles both HTML and markdown
export function parseAdaptiveTableFormat(content: string): ParsedContent {
  console.log('Starting adaptive table parsing...');
  
  let lineItems: LineItem[];
  let parsingMethod: 'html_tables' | 'markdown_tables';
  let tableCount = 0;
  
  // Check if content contains HTML tables
  if (content.includes('<table') && content.includes('</table>')) {
    console.log('Detected HTML table format');
    const htmlTables = parseHTMLTables(content);
    lineItems = convertHTMLTablesToLineItems(htmlTables);
    parsingMethod = 'html_tables';
    tableCount = htmlTables.length;
  } else {
    // Fallback to existing markdown parsing
    console.log('No HTML tables detected, using markdown parser');
    const { tables } = parseMarkdownTables(content);
    lineItems = extractLineItemsFromMarkdownTables(tables);
    parsingMethod = 'markdown_tables';
    tableCount = tables.length;
  }
  
  console.log(`Final extracted line items using ${parsingMethod}: ${lineItems.length}`);
  
  return {
    lineItems,
    metadata: {
      total_items: lineItems.length,
      total_tables: tableCount,
      parsing_method: parsingMethod,
      parse_time: new Date().toISOString()
    }
  };
}