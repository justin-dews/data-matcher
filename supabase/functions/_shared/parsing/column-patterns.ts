// Advanced column mapping patterns - covers multiple naming conventions

export const ADAPTIVE_COLUMN_PATTERNS = {
  // Item/SKU/Part Number patterns (highest priority)
  item_identifier: [
    /^item$/i, /^sku$/i, /^part[\s_-]?number$/i, /^part[\s_-]?num$/i, /^part$/i,
    /^product[\s_-]?code$/i, /^model$/i, /^model[\s_-]?number$/i,
    /^catalog[\s_-]?number$/i, /^catalog$/i, /^item[\s_-]?code$/i,
    /^product[\s_-]?id$/i, /^item[\s_-]?id$/i, /^mfg[\s_-]?part$/i, /^manufacturer[\s_-]?part$/i
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

// Legacy column patterns for markdown table parsing
export const LEGACY_COLUMN_PATTERNS = {
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

export function mapColumnsToFields(headers: string[]): Record<string, number> {
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

export function findColumnIndex(headers: string[], patterns: string[], excludeIndices: number[] = []): number {
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