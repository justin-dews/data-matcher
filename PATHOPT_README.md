# PathoptMatch - AI-Powered Document Matching System

PathoptMatch is an advanced document parsing and matching system that combines AI-powered PDF parsing (LlamaParse) with hybrid matching algorithms to achieve >95% accuracy in matching competitor products to internal catalogs.

## 🚀 Key Features

- **AI-Powered PDF Parsing**: Uses LlamaParse for structured data extraction from competitor documents
- **Hybrid Matching Algorithm**: Combines vector similarity (0.6) + trigram matching (0.3) + learned aliases (0.2)
- **Progressive Learning**: Approved matches automatically create competitor aliases for improved future matching
- **Multi-Tenant Architecture**: Full organization support with Row Level Security (RLS)
- **Real-time Processing**: Edge Functions for external API calls with proper secret management
- **Comprehensive Analytics**: Track matching accuracy, processing volumes, and system performance

## 🏗️ Architecture

### Core Components
- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS
- **Backend**: Supabase with PostgreSQL extensions (pgvector, pg_trgm, fuzzystrmatch)
- **AI Services**: OpenAI (embeddings), LlamaParse (PDF parsing)
- **Storage**: Supabase Storage for PDF documents

### Database Schema
- `organizations` - Multi-tenant organization management
- `profiles` - User profiles linked to organizations
- `products` - Internal product catalog
- `product_embeddings` - Vector embeddings for similarity search
- `documents` - Uploaded PDF documents and parse results
- `line_items` - Extracted line items from documents
- `matches` - Matching decisions with confidence scores
- `competitor_aliases` - Learned competitor product mappings
- `settings` - Organization-specific configuration
- `activity_log` - Audit trail and activity tracking

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+
- Docker (for local Supabase)
- OpenAI API key
- LlamaParse API key

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Local Supabase
```bash
# Install Supabase CLI
npm install -g supabase

# Initialize and start local instance
supabase init
supabase start
```

### 3. Environment Configuration
Copy `.env.local.example` to `.env.local` and fill in your API keys:

```bash
cp .env.local.example .env.local
```

Update the following values:
- `OPENAI_API_KEY`: Your OpenAI API key for embeddings
- `LLAMAPARSE_API_KEY`: Your LlamaParse API key for PDF parsing

### 4. Database Setup
Run the database migrations:
```bash
supabase db reset
```

This will:
- Enable required PostgreSQL extensions (vector, pg_trgm, fuzzystrmatch, unaccent)
- Create all tables with proper RLS policies
- Set up storage buckets for PDF uploads
- Install hybrid matching functions

### 5. Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 📊 Matching Algorithm

The hybrid matching system combines three scoring methods:

### 1. Vector Similarity (Weight: 0.6)
- Uses OpenAI embeddings (text-embedding-ada-002)
- Cosine similarity between query and product embeddings
- Best for semantic understanding and fuzzy matching

### 2. Trigram Matching (Weight: 0.3)
- PostgreSQL trigram similarity using pg_trgm
- Excellent for handling typos and variations
- Works on product names, SKUs, and manufacturer names

### 3. Alias Boosting (Weight: 0.2)
- Learned competitor aliases from approved matches
- Provides exact matching for known competitor products
- Improves accuracy over time through machine learning

### Confidence Thresholds
- **Auto-approve**: `>= 0.9` (90%+ confidence)
- **Manual review**: `0.4 - 0.89`
- **Auto-reject**: `< 0.4`

## 🎯 Usage Workflow

1. **Upload Documents**: PDF competitor catalogs or price lists
2. **AI Parsing**: LlamaParse extracts structured line items
3. **Hybrid Matching**: System generates match candidates with confidence scores
4. **Manual Review**: Review pending matches above confidence threshold
5. **Learning**: Approved matches create competitor aliases for future use
6. **Export**: Generate CSV reports with matched products and pricing

## 🔐 Security Features

- **Row Level Security (RLS)**: All data is organization-scoped
- **Authentication**: Supabase Auth with email/password
- **API Security**: Rate limiting and input validation
- **File Security**: PDF uploads restricted to authenticated users
- **Data Privacy**: No data sharing between organizations

## 📈 Monitoring & Analytics

- **Processing Metrics**: Document parsing success rates
- **Matching Accuracy**: Confidence score distributions
- **User Activity**: Audit trail of all actions
- **Performance**: API response times and throughput

## 🚢 Deployment

### Supabase Cloud Setup
1. Create a new Supabase project
2. Run migrations: `supabase db push`
3. Update environment variables with production URLs

### Vercel Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Environment Variables for Production
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
LLAMAPARSE_API_KEY=your_llamaparse_key
```

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## 📚 API Documentation

### Core Endpoints
- `POST /api/embeddings` - Generate text embeddings
- `POST /api/parse` - Parse PDF documents with LlamaParse
- `POST /api/match` - Find product matches for line items
- `GET /api/matches` - Retrieve matching results
- `POST /api/matches/approve` - Approve/reject matches

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in `/docs`
- Review the troubleshooting guide in `/docs/troubleshooting.md`

---

**PathoptMatch v1.0** - Built with Next.js, Supabase, and AI technologies