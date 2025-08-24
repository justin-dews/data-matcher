#!/bin/bash

# PathoptMatch Edge Functions Deployment Script

set -e

echo "🚀 Deploying PathoptMatch Edge Functions..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if logged in to Supabase
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please run:"
    echo "   supabase login"
    exit 1
fi

# Deploy parse-pdf function
echo "📄 Deploying parse-pdf function..."
supabase functions deploy parse-pdf --project-ref ${SUPABASE_PROJECT_REF:-}

# Deploy embed-text function
echo "🧠 Deploying embed-text function..."
supabase functions deploy embed-text --project-ref ${SUPABASE_PROJECT_REF:-}

echo "✅ All functions deployed successfully!"

echo ""
echo "🔧 Don't forget to set the following environment variables in your Supabase dashboard:"
echo "   - LLAMAPARSE_API_KEY"
echo "   - OPENAI_API_KEY"
echo "   - SUPABASE_SERVICE_ROLE_KEY"
echo ""
echo "📖 Function URLs:"
echo "   Parse PDF: https://${SUPABASE_PROJECT_REF:-your-project-ref}.functions.supabase.co/parse-pdf"
echo "   Embed Text: https://${SUPABASE_PROJECT_REF:-your-project-ref}.functions.supabase.co/embed-text"