# Upload & Parse Implementation

This document describes the complete Upload & Parse functionality implemented for PathoptMatch.

## Overview

The Upload & Parse page allows users to upload PDF documents and automatically extract line item data using AI parsing. The implementation includes file upload, document processing, real-time progress tracking, and an editable table for extracted data.

## Components Created

### Page Components

1. **`/src/app/dashboard/upload/page.tsx`** - Main upload page
   - File selection and upload interface
   - Parser preset selection
   - Progress tracking during parsing
   - Editable extracted data table
   - Complete state management for upload flow

### UI Components

2. **`/src/components/upload/FileDropzone.tsx`**
   - Drag & drop file upload interface
   - PDF file validation (type and size limits)
   - File preview with metadata display
   - Error handling for invalid files

3. **`/src/components/upload/ParsePresetSelector.tsx`**
   - Document type selection (Invoice, Receipt, Packing Slip, etc.)
   - Visual preset cards with descriptions
   - Field preview for each preset type

4. **`/src/components/upload/ParsingProgress.tsx`**
   - Real-time progress indicator
   - Step-by-step status display
   - Animated progress bars and status icons

5. **`/src/components/upload/ExtractedDataTable.tsx`**
   - Inline editing of extracted line items
   - Currency and number formatting
   - Comprehensive data display with totals
   - Save/cancel editing functionality

### API Routes

6. **`/src/app/api/upload/route.ts`**
   - Handles file upload to Supabase Storage
   - Creates document records in database
   - Triggers PDF parsing Edge Function
   - Complete error handling and validation

### Updated Components

7. **`/src/components/layout/Sidebar.tsx`**
   - Added "Upload & Parse" navigation item
   - Icon and routing integration

## Features Implemented

### File Upload & Validation
- **Drag & drop interface** with visual feedback
- **PDF-only validation** with 50MB size limit
- **File metadata display** (name, size, type)
- **Upload progress tracking**

### Document Type Presets
- **Invoice**: Optimized for invoices with line items, prices, and SKUs
- **Receipt**: Focused on retail receipts with items and totals
- **Packing Slip**: Extracts shipped items with quantities and part numbers
- **Purchase Order**: Comprehensive extraction for PO line items
- **Custom**: Flexible parsing for general documents

### AI-Powered Parsing
- **LlamaParse integration** via Supabase Edge Functions
- **Preset-specific parsing instructions** for optimal extraction
- **Structured data extraction** (description, quantity, prices, SKUs)
- **Background processing** with job status polling

### Real-Time Progress
- **Multi-step progress indicator** (Upload → Parse → Complete)
- **Live status updates** during processing
- **Error handling** with detailed error messages
- **Automatic polling** for job completion

### Editable Data Table
- **Inline editing** with click-to-edit functionality
- **Multiple data types** (text, numbers, currency)
- **Real-time updates** to Supabase database
- **Summary calculations** (line totals, document total)
- **Keyboard shortcuts** (Enter to save, Escape to cancel)

## Technical Implementation

### State Management
- React state with TypeScript interfaces
- Complex upload state management
- Real-time synchronization with database
- Error boundary handling

### Database Integration
- **Documents table**: Upload metadata and status tracking
- **Line Items table**: Extracted data storage
- **Real-time updates**: Status polling and data sync
- **Organization context**: Multi-tenant data isolation

### File Storage
- **Supabase Storage**: Secure PDF file storage
- **Organized paths**: User-based file organization
- **Access control**: RLS policy integration

### Edge Functions
- **parse-pdf**: LlamaParse integration with preset support
- **Preset-specific instructions**: Optimized parsing for different document types
- **Background processing**: Async job handling
- **Error recovery**: Comprehensive error handling

### Type Safety
- **Complete TypeScript coverage** for all components
- **Database type definitions** aligned with Supabase schema
- **Interface definitions** for all data structures
- **Type-safe API routes** with proper error handling

## Configuration

### Environment Variables
```bash
# Production Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://theattidfeqxyaexiqwj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Required for PDF parsing
LLAMAPARSE_API_KEY=your_llamaparse_key_here
```

### Supabase Setup
- **Storage bucket**: "documents" with proper RLS policies
- **Edge Functions**: parse-pdf and embed-text deployed
- **Database tables**: documents, line_items, organizations, profiles

## Usage Flow

1. **Upload**: User selects PDF file via drag & drop or file picker
2. **Preset**: User chooses document type for optimized parsing
3. **Processing**: File uploads to Supabase, parsing job starts
4. **Progress**: Real-time updates show parsing progress
5. **Review**: Extracted data displays in editable table
6. **Edit**: User can modify any extracted values inline
7. **Complete**: Data saved to database for matching workflow

## File Structure
```
src/
├── app/
│   ├── api/upload/route.ts          # Upload API endpoint
│   └── dashboard/upload/page.tsx    # Main upload page
├── components/
│   ├── upload/
│   │   ├── FileDropzone.tsx         # File upload interface
│   │   ├── ParsePresetSelector.tsx  # Document type selection
│   │   ├── ParsingProgress.tsx      # Progress indicator
│   │   └── ExtractedDataTable.tsx   # Editable results table
│   └── layout/Sidebar.tsx           # Updated navigation
└── lib/
    ├── supabase.ts                  # Database client & types
    └── utils.ts                     # Utility functions

supabase/
└── functions/
    └── parse-pdf/index.ts           # Enhanced parsing function
```

## Next Steps

The Upload & Parse functionality is complete and ready for use. Future enhancements could include:

- **Batch upload**: Multiple document processing
- **Template creation**: Custom parsing presets
- **Advanced validation**: Field-level data validation
- **Export options**: CSV/Excel export of extracted data
- **Audit trail**: Change tracking for edited data

## Integration Points

This implementation integrates seamlessly with:
- **Product matching**: Extracted line items feed into matching workflow
- **Organization context**: Multi-tenant data isolation
- **User authentication**: Secure access control
- **Database schema**: Aligned with existing data structure