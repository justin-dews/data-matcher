// Core parsing types for PDF document processing

export interface TableRow {
  cells: string[];
  lineNumber: number;
}

export interface Table {
  headers: string[];
  rows: TableRow[];
  startLine: number;
  endLine: number;
}

export interface ExtractedTable {
  headers: string[];
  rows: string[][];
  tableType: 'line_items' | 'metadata' | 'unknown';
  confidence: number;
}

export interface LineItem {
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

export interface ParsedContent {
  lineItems: LineItem[];
  metadata: {
    total_items: number;
    total_tables: number;
    parsing_method: 'html_tables' | 'markdown_tables';
    parse_time: string;
  };
}

export interface ColumnMapping {
  [key: string]: number;
}

export interface ParsingResult {
  success: boolean;
  data?: ParsedContent;
  error?: string;
}