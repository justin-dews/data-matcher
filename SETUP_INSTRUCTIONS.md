# PathoptMatch Database Setup Instructions

## Manual Setup Required

The automated migration script encountered API limitations. Please follow these manual steps to complete the database setup:

## Step 1: Access Supabase Dashboard

1. Go to your Supabase project: https://theattidfeqxyaexiqwj.supabase.co
2. Navigate to the SQL Editor in the left sidebar
3. Create a new query

## Step 2: Execute Database Schema

Copy and execute the following SQL in the SQL Editor:

### Extensions and Types
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA extensions;

-- Create custom types
CREATE TYPE match_status AS ENUM ('pending', 'approved', 'rejected', 'auto_matched');
CREATE TYPE document_status AS ENUM ('uploading', 'parsing', 'parsed', 'failed');
```

### Core Tables
```sql
-- Organizations table (multi-tenant support)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table (internal catalog)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    manufacturer TEXT,
    price DECIMAL(10,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, sku)
);

-- Product embeddings for vector similarity search
CREATE TABLE product_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    embedding vector(1536), -- OpenAI ada-002 embedding size
    text_content TEXT NOT NULL, -- The text that was embedded
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table (uploaded PDFs)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_size INTEGER,
    file_path TEXT NOT NULL,
    status document_status DEFAULT 'uploading',
    parse_job_id TEXT, -- LlamaParse job ID
    parse_result JSONB, -- Structured data from LlamaParse
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Line items extracted from documents
CREATE TABLE line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    line_number INTEGER,
    raw_text TEXT NOT NULL,
    parsed_data JSONB, -- Structured fields (name, quantity, price, etc.)
    quantity DECIMAL(10,3),
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competitor aliases (learned mappings)
CREATE TABLE competitor_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    competitor_name TEXT NOT NULL,
    competitor_sku TEXT,
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    created_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, competitor_name, competitor_sku)
);

-- Matches table (decisions and scores)
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_item_id UUID NOT NULL REFERENCES line_items(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status match_status DEFAULT 'pending',
    confidence_score DECIMAL(3,2),
    vector_score DECIMAL(3,2),
    trigram_score DECIMAL(3,2),
    alias_score DECIMAL(3,2),
    final_score DECIMAL(3,2),
    matched_text TEXT,
    reasoning TEXT,
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings table for configuration
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, key)
);

-- Activity log for audit trail
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Step 3: Create Indexes

Execute the complete migration files in order:
1. `/Users/justindews/Documents/Code_Projects/data-matcher/supabase/migrations/20240101000000_initial_schema.sql`
2. `/Users/justindews/Documents/Code_Projects/data-matcher/supabase/migrations/20240101000001_hybrid_matching_function.sql`
3. `/Users/justindews/Documents/Code_Projects/data-matcher/supabase/migrations/20240101000002_storage_setup.sql`

## Step 4: Set Up Storage

1. Go to Storage in your Supabase dashboard
2. Create a new bucket called "documents"
3. Set it to private
4. Set file size limit to 50MB
5. Allow only PDF files

## Step 5: Verify Setup

After completing the manual setup, run:
```bash
cd /Users/justindews/Documents/Code_Projects/data-matcher
node test-setup.js
```

## Alternative: Use Supabase CLI

If you have owner access to the project:
```bash
cd /Users/justindews/Documents/Code_Projects/data-matcher
supabase db reset --linked
```

## Connection Details for Reference

- **URL**: https://theattidfeqxyaexiqwj.supabase.co
- **Service Role Key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw

## Important Notes

- The vector extension requires the pg_vector extension to be enabled
- Row Level Security (RLS) policies are included in the migrations
- All tables are organization-scoped for multi-tenancy
- The hybrid matching function combines vector similarity, trigram matching, and alias scoring