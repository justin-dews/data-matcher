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
- **hybrid_product_match_tiered** - Advanced 4-tier hierarchical matching system with training data priority
  - Tier 1: Exact training matches (>95% similarity) → Score 1.0 (perfect match)
  - Tier 2: Good training matches (80-95%) → Score 0.85-0.95  
  - Tier 3: Algorithmic matching (vector 0.6 + trigram 0.3 + alias 0.2 weights)
  - Tier 4: Training boost for partial patterns
- **match_training_data** - Stores approved matches for machine learning enhancement

### External Services Integration
- **Edge Functions**: `supabase/functions/` for external API calls
  - `parse-pdf/` - **✅ FULLY FUNCTIONAL** LlamaParse integration for document parsing with robust column detection
  - `embed-text/` - OpenAI embeddings API integration
  - `fix-hybrid-function/` - Database function maintenance
- **API Routes**: `src/app/api/` for internal operations
  - `generate-matches/` - **✅ FULLY FUNCTIONAL** Automatic match generation using tiered matching system

### Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **AI Services**: LlamaParse (PDF parsing), OpenAI (embeddings)
- **Database Extensions**: pgvector, pg_trgm, fuzzystrmatch, unaccent
- **UI Components**: Headless UI, Heroicons, Lucide React

## Current System Status (Updated: August 2025)

### ✅ Fully Functional Features
1. **Complete Document-to-Matches Pipeline** - Fully automated end-to-end workflow
   - File upload via drag-and-drop interface (`/dashboard/upload`)
   - Automatic PDF processing through LlamaParse API
   - **AUTOMATIC MATCH GENERATION** - Matches created instantly during upload
   - Smart column detection for various document formats:
     - Product Code, Item ID, SKU, Part Number, Model Number
     - Quantity, Unit Price, Total, Description, UOM
   - Robust fallback logic for unrecognized column structures
   - Real-time progress tracking during upload (includes matching at 85%)
   - Extracted line items displayed in editable table format

2. **Advanced AI-Powered Matching System** - **✅ PRODUCTION READY**
   - **Tiered Hierarchical Matching** with training data taking absolute priority
   - **Training Data Integration** - Exact matches get perfect 1.0 scores instantly
   - **Multiple Matching Algorithms**: Vector similarity, trigram matching, fuzzy matching, alias learning
   - **Automatic Match Generation** during document upload - no manual steps required
   - **Machine Learning Enhancement** - Approved matches improve future matching accuracy
   - **Confidence Scoring** with detailed reasoning for each match

3. **Comprehensive Matching Review Interface** (`/dashboard/matches`)
   - View all line items with their matched products
   - **Status Management**: Pending → Approved/Rejected → Reset workflow
   - **Bulk Operations**: Approve all, reject all, reset rejected items
   - **Detailed Match Information**: Confidence scores, reasoning, match source
   - **Training Match Indicators**: Perfect 100% confidence for exact training matches
   - **Interactive Workflow**: Approve, reject, or manually select alternative matches

4. **Training Data Management**
   - **CSV Import System** for training data with validation
   - **Automatic Quality Assessment** (excellent/good/fair/poor)
   - **Product Catalog Verification** - Ensures SKUs exist before import
   - **Match Learning Loop** - Approved matches automatically become training data

5. **User Interface & Experience**
   - Dashboard with navigation sidebar (6 main sections)
   - Upload page with file dropzone and progress indicators
   - Matches page with comprehensive review capabilities
   - Responsive design with Tailwind CSS
   - Real-time progress tracking and error handling

### 🚧 In Development / Planned Features
- Enhanced product catalog management interface
- Advanced export functionality with multiple formats
- Bulk catalog import/export features
- Advanced analytics and reporting dashboard
- API integrations for external systems

### 📋 Key Implementation Details
- **Parse Function**: `supabase/functions/parse-pdf/index.ts` with 30+ column patterns including "ITEM ID"
- **Automatic Matching**: `src/app/api/generate-matches/route.ts` with tiered matching integration
- **Upload Pipeline**: `src/app/dashboard/upload/page.tsx` with integrated automatic matching
- **Matching Interface**: `src/app/dashboard/matches/page.tsx` with full workflow management
- **Training System**: `import-training-data.js` with CSV validation and product verification
- **Data Pipeline**: Upload → Parse → **Auto-Match** → Store → Review → Approve workflow

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

### Advanced Tiered Matching System
The system uses a 4-tier hierarchical approach that prioritizes training data:
1. **Tier 1: Exact Training Matches** (>95% similarity) - Perfect score 1.0, instant matching
2. **Tier 2: Good Training Matches** (80-95% similarity) - High confidence scores 0.85-0.95
3. **Tier 3: Algorithmic Hybrid Matching** - Vector (60%) + Trigram (30%) + Alias (20%) weights
4. **Tier 4: Training Boost** - Partial pattern enhancement from learned data

**Key Innovation**: Training data takes absolute priority over algorithmic matching, ensuring exact matches always score perfectly.

## 🎯 Complete Automatic Workflow (Production Ready)

The system now provides a fully automated document-to-matches pipeline:

### **User Experience Flow**
1. **Upload Document** (`/dashboard/upload`) - Drag & drop PDF invoice/quote
2. **Automatic Processing** (Progress: 0% → 100%)
   - **20%**: File uploaded to Supabase Storage
   - **40%**: Document record created in database
   - **60%**: PDF parsed via LlamaParse API (extracts line items)
   - **80%**: Line items inserted into database
   - **85%**: **🎯 AUTOMATIC MATCH GENERATION** - Tiered matching runs
   - **100%**: Processing complete with matches ready for review
3. **Review Matches** (`/dashboard/matches`) - All matches immediately available
4. **Approve/Reject** - Bulk operations or individual review
5. **Learning Loop** - Approved matches enhance future accuracy

### **What Users See**
- **Training Data Matches**: Perfect 100.0% confidence scores
- **Algorithmic Matches**: Variable confidence with detailed reasoning
- **No Manual Steps**: Matches appear instantly after upload
- **Status Indicators**: Pending (yellow) → Approved (green) → Rejected (red)
- **Bulk Actions**: Approve all high-confidence matches with one click

### **Behind the Scenes**
- **Tiered Matching**: Training data gets checked first for instant 1.0 scores
- **Fallback Logic**: If no training match, uses hybrid algorithmic matching
- **Quality Assurance**: Only matches above threshold (0.2) are created
- **Learning Integration**: System learns from every approved match

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

**Automatic Matching Implementation:**
- Match generation must be integrated into upload pipeline, not separate manual step
- Infinite loops can occur with improper line item filtering - use application-level filtering
- Database column mismatches cause silent failures - validate schema before insert operations
- Training data takes absolute priority - implement tiered matching for best user experience
- Progress indicators should include matching step (85%) to show users processing is happening

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

## 🏆 Current Production Capabilities Summary

**PathoptMatch** is now a **production-ready AI-powered document matching system** that delivers:

### **Core Value Proposition**
- **Zero Manual Matching**: Upload PDF → Get matches automatically
- **Perfect Training Data Integration**: Known matches score 1.0 instantly
- **Comprehensive Workflow**: Upload → Parse → Match → Review → Approve
- **Learning System**: Every approval improves future accuracy
- **Multi-tenant Architecture**: Secure organization-based isolation

### **Technical Excellence**
- **Advanced AI**: 4-tier hierarchical matching with training data priority
- **Robust Parsing**: Handles various PDF formats with 30+ column patterns
- **Real-time Processing**: Progress tracking from 0% to 100% with matching at 85%
- **Type-safe Architecture**: Full TypeScript integration with Supabase
- **Scalable Infrastructure**: Supabase + PostgreSQL with vector embeddings

### **User Experience**
- **Intuitive Interface**: Dashboard with 6 main sections
- **Bulk Operations**: Approve/reject multiple matches at once
- **Status Management**: Clear pending → approved → rejected workflow
- **Training Indicators**: 100% confidence scores for perfect matches
- **Error Recovery**: Reset rejected items back to pending for re-evaluation

The system successfully transforms the complex task of competitor catalog matching into a streamlined, automated workflow that learns and improves with each use.