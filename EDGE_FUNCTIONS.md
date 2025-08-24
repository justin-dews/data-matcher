# PathoptMatch Edge Functions

This document describes the Edge Functions implemented for PDF parsing and text embedding in the PathoptMatch system.

## Overview

The PathoptMatch system includes two main Edge Functions:

1. **parse-pdf**: Processes PDF invoices using LlamaParse API
2. **embed-text**: Generates text embeddings using OpenAI API

## Functions

### parse-pdf

Processes uploaded PDF documents by sending them to the LlamaParse API for structured data extraction.

**Endpoint**: `POST /functions/v1/parse-pdf`

**Request Body**:
```json
{
  "document_id": "uuid",
  "file_path": "path/to/file.pdf"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "line_items": [
      {
        "line_number": 1,
        "description": "Product Name",
        "quantity": 5,
        "unit_price": 10.50,
        "total_price": 52.50,
        "sku": "ABC123",
        "manufacturer": "Brand Name"
      }
    ],
    "metadata": {
      "total_lines": 15,
      "invoice_number": "INV-001",
      "vendor": "Supplier Name"
    }
  }
}
```

**Features**:
- Downloads files from Supabase Storage
- Submits to LlamaParse API with custom parsing instructions
- Waits for job completion (up to 5 minutes)
- Extracts structured line items from markdown results
- Updates document status in database
- Creates line_items records automatically

### embed-text

Generates vector embeddings for text content using OpenAI's text-embedding-ada-002 model.

**Endpoint**: `POST /functions/v1/embed-text`

**Request Body**:
```json
{
  "texts": ["Product description 1", "Product description 2"],
  "product_ids": ["uuid1", "uuid2"]  // Optional: for storing in database
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "embeddings": [[0.1, 0.2, ...], [0.3, 0.4, ...]],
    "usage": {
      "prompt_tokens": 50,
      "total_tokens": 50
    }
  }
}
```

**GET Endpoint**: `GET /functions/v1/embed-text?organization_id=uuid&product_id=uuid`

Retrieves existing embeddings from the database.

**Features**:
- Processes texts in batches (100 at a time)
- Automatically stores embeddings in product_embeddings table
- Handles token limits and text cleaning
- Supports both generation and retrieval

## Environment Variables

Set these in your Supabase project dashboard:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
LLAMAPARSE_API_KEY=your-llamaparse-api-key
OPENAI_API_KEY=your-openai-api-key
```

## Deployment

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Deploy functions:
```bash
./deploy-functions.sh
```

Or deploy individually:
```bash
supabase functions deploy parse-pdf
supabase functions deploy embed-text
```

## Error Handling

Both functions implement comprehensive error handling:

- Input validation
- API error handling
- Database transaction safety
- Graceful fallbacks
- Detailed error reporting

## Usage Example

### Processing a PDF Document

1. Upload PDF to Supabase Storage
2. Create document record in database
3. Call parse-pdf function:

```javascript
const response = await fetch('https://your-project.functions.supabase.co/parse-pdf', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({
    document_id: 'document-uuid',
    file_path: 'documents/invoice.pdf'
  })
});

const result = await response.json();
```

### Generating Embeddings

```javascript
const response = await fetch('https://your-project.functions.supabase.co/embed-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({
    texts: ['Product description text'],
    product_ids: ['product-uuid']  // Optional
  })
});

const result = await response.json();
```

## Integration with PathoptMatch

These functions integrate seamlessly with the PathoptMatch database schema:

- **parse-pdf** updates document status and creates line_items
- **embed-text** populates the product_embeddings table
- Both respect RLS policies through service role key
- Support multi-tenant organizations

## Performance Considerations

- **parse-pdf**: Processing time depends on document size (typically 30-120 seconds)
- **embed-text**: Batch processing optimizes API usage and costs
- Both functions include timeout handling and retry logic
- Database operations use proper indexing for performance