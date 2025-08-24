#!/bin/bash

# PathoptMatch Development Setup Script
echo "🚀 Setting up PathoptMatch development environment..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "📦 Installing Supabase CLI..."
    npm install -g supabase
else
    echo "✅ Supabase CLI already installed"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and run this script again."
    exit 1
else
    echo "✅ Docker is running"
fi

# Initialize Supabase if not already done
if [ ! -f "supabase/config.toml" ]; then
    echo "🔧 Initializing Supabase..."
    supabase init
else
    echo "✅ Supabase already initialized"
fi

# Start Supabase services
echo "🚀 Starting Supabase services..."
supabase start

# Wait a bit for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Run database migrations
echo "🗄️ Running database migrations..."
supabase db reset --linked false

# Check if migrations ran successfully
if [ $? -eq 0 ]; then
    echo "✅ Database migrations completed successfully"
else
    echo "❌ Database migrations failed"
    exit 1
fi

# Display connection info
echo ""
echo "🎉 Setup complete! Your PathoptMatch development environment is ready."
echo ""
echo "📋 Connection Information:"
echo "   API URL: http://localhost:54321"
echo "   GraphQL URL: http://localhost:54321/graphql/v1"
echo "   DB URL: postgresql://postgres:postgres@localhost:54322/postgres"
echo "   Studio URL: http://localhost:54323"
echo "   Inbucket URL: http://localhost:54324"
echo ""
echo "🔐 Authentication:"
echo "   Service Role Key: (check .env.local)"
echo "   Anon Key: (check .env.local)"
echo ""
echo "🚀 Start the Next.js development server:"
echo "   npm run dev"
echo ""
echo "📚 Next steps:"
echo "   1. Update .env.local with your OpenAI and LlamaParse API keys"
echo "   2. Visit http://localhost:3000 to access the application"
echo "   3. Create an account and start uploading documents"
echo ""

# Check if environment file exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  Creating .env.local from template..."
    cp .env.local.example .env.local
    echo "   Please update .env.local with your API keys!"
fi

echo "✨ Happy matching!"