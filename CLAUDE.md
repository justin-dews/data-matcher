# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PathoptMatch is an AI-powered document parsing and matching system that helps businesses match competitor product catalogs to their own inventory using hybrid AI algorithms combining vector similarity, trigram matching, and learned aliases.

**Production Database**: https://theattidfeqxyaexiqwj.supabase.co

## Development Commands

### Core Development
- `npm run dev` - Start Next.js development server with Turbopack (http://localhost:3000)
- `npm run build` - Build production version with Turbopack
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality
- `npm run type-check` - Run TypeScript type checking (use this to validate changes)

### Database & Supabase
- `npm run setup` - Run full development setup (requires Docker)
- `npm run db:start` - Start local Supabase services
- `npm run db:stop` - Stop local Supabase services  
- `npm run db:status` - Check Supabase service status
- `npm run db:reset` - Reset database with fresh migrations

### Manual Setup
- `./setup-dev.sh` - Automated development environment setup script
- `supabase start` - Start Supabase services (API: 54321, Studio: 54323, DB: 54322)
- `supabase db reset` - Reset database with migrations

## Architecture Overview

### Frontend Structure (Next.js 15 + App Router)
- **App Directory**: `src/app/` - Next.js app router with nested layouts
- **Components**: `src/components/` - Organized by feature (auth, dashboard, upload, matches, etc.)
- **Lib**: `src/lib/` - Utilities, Supabase client, and shared functions
- **Layout System**: Dashboard uses sidebar navigation with 6 main pages

### Database Architecture (Supabase + PostgreSQL)
The system uses a multi-tenant architecture with the following core entities:
- **organizations** - Multi-tenant organization data
- **profiles** - User profiles linked to organizations  
- **products** - Internal product catalog with embeddings
- **documents** - Uploaded PDF files and parse status
- **line_items** - Extracted line items from parsed documents
- **matches** - Match decisions with confidence scores and reasoning
- **competitor_aliases** - Learned competitor → product mappings
- **product_embeddings** - Vector embeddings for semantic matching

### Key Functions
- **hybrid_product_match** - Core RPC function implementing hybrid matching algorithm (vector 0.6 + trigram 0.3 + alias 0.2 weights)

### External Services Integration
- **Edge Functions**: `supabase/functions/` for external API calls
  - `parse-pdf/` - **✅ FULLY FUNCTIONAL** LlamaParse integration for document parsing with robust column detection
  - `embed-text/` - OpenAI embeddings API integration
  - `fix-hybrid-function/` - Database function maintenance

### Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **AI Services**: LlamaParse (PDF parsing), OpenAI (embeddings)
- **Database Extensions**: pgvector, pg_trgm, fuzzystrmatch, unaccent
- **UI Components**: Headless UI, Heroicons, Lucide React

## Current System Status (Updated: August 2025)

### ✅ Fully Functional Features
1. **PDF Upload & Parsing Pipeline** - Complete end-to-end workflow
   - File upload via drag-and-drop interface (`/dashboard/upload`)
   - Automatic PDF processing through LlamaParse API
   - Smart column detection for various document formats:
     - Product Code, Item ID, SKU, Part Number, Model Number
     - Quantity, Unit Price, Total, Description, UOM
   - Robust fallback logic for unrecognized column structures
   - Real-time progress tracking during upload
   - Extracted line items displayed in editable table format

2. **Document Processing Features**
   - Supports various invoice/quote PDF formats
   - Handles tables with different column arrangements
   - Correctly extracts product identifiers (not sequential numbers)
   - Preserves pricing, quantities, and descriptions
   - Stores parsed data in PostgreSQL with full audit trail

3. **User Interface**
   - Dashboard with navigation sidebar
   - Upload page with file dropzone and progress indicators
   - Extracted data table with inline editing capabilities
   - Responsive design with Tailwind CSS
   - Error handling and user feedback

### 🚧 In Development / Planned Features
- Product catalog management
- AI-powered product matching algorithm
- Competitor alias learning system
- Export functionality
- Advanced matching review interface

### 📋 Key Implementation Details
- **Parse Function**: `supabase/functions/parse-pdf/index.ts` with 30+ column patterns
- **Upload Component**: `src/components/upload/ExtractedDataTable.tsx` with inline editing
- **API Integration**: Uses LlamaParse for reliable PDF-to-markdown conversion
- **Data Pipeline**: Upload → Parse → Store → Display → Edit workflow

## Key Development Patterns

### Database Types
Complete TypeScript database types are defined in `src/lib/supabase.ts` with full type safety for all tables, inserts, updates, and RPC functions.

### Authentication Flow
- Uses Supabase Auth with email/password and magic links
- Protected routes via `useAuth` hook in dashboard layout
- Row Level Security (RLS) policies for multi-tenant isolation

### Component Organization
```
src/components/
├── auth/          - Authentication forms
├── catalog/       - Product catalog management
├── dashboard/     - Dashboard overview components  
├── exports/       - Export functionality
├── layout/        - Header, sidebar navigation
├── matches/       - Matching review interface
├── settings/      - Configuration pages
├── ui/            - Reusable UI components
└── upload/        - File upload and parsing
```

### Matching Algorithm
The core hybrid matching combines:
1. **Vector similarity** (60% weight) - Semantic understanding via embeddings
2. **Trigram similarity** (30% weight) - Fuzzy text matching  
3. **Alias learning** (20% weight) - Learned competitor mappings

## Important Notes

- Always run `npm run type-check` after making changes to validate TypeScript
- Database migrations are in `supabase/migrations/` 
- Environment variables should be in `.env.local` (not committed)
- The app uses `@` imports alias pointing to `src/`
- RLS policies ensure proper multi-tenant data isolation
- Edge functions handle external API calls to avoid CORS issues
- Learning loop: approved matches create competitor aliases for future improvements

### 🔧 Development Lessons Learned

**PDF Parsing Implementation:**
- LlamaParse extracts tables as markdown with varying column headers
- Column detection requires comprehensive patterns AND smart fallback logic
- Document structures vary significantly: "Product Code", "Item ID", "SKU", "Part Number", etc.
- Sequential numbers in "Line Item" columns should not be used as product identifiers
- Exact pattern matching with fallback to partial matching prevents false positives
- Smart scanning of unassigned columns catches edge cases

**Authentication & API Routes:**
- Supabase Edge Functions require proper environment variables (not demo keys)
- RLS policies can block standard client operations - use admin client for API routes
- Edge function logs don't appear in Next.js dev server console

**Development Workflow:**
- Test column detection with actual PDF documents, not synthetic data
- Use direct API testing scripts to debug edge functions independently
- Clean slate implementations often work better than incremental fixes for complex systems

## Development Workflow
1. Start Supabase services: `npm run db:start`  
2. Start Next.js dev server: `npm run dev`
3. Access Supabase Studio: http://localhost:54323
4. Make changes and run type checking: `npm run type-check`
5. Test locally before deployment

## File Structure Notes
- Dashboard pages are in `src/app/dashboard/[page]/page.tsx`
- Each dashboard page has corresponding components in `src/components/[page]/`
- API routes are in `src/app/api/` for Next.js API endpoints
- Supabase Edge Functions are separate from Next.js API routes