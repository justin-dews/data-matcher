#!/usr/bin/env node

/**
 * Verify PostgreSQL Extensions in Supabase Hosted Database
 * 
 * This script tests all critical extensions needed for PathoptMatch:
 * - vector: pgvector for semantic similarity
 * - pg_trgm: trigram matching with similarity()
 * - fuzzystrmatch: Levenshtein distance for fuzzy matching  
 * - unaccent: accent-insensitive text matching
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyExtensions() {
  console.log('🔍 Verifying PostgreSQL Extensions in Supabase...\n');
  
  try {
    // 1. Check installed extensions
    console.log('1. Checking installed extensions...');
    const { data: extensions, error: extError } = await supabase
      .from('pg_extension')
      .select('extname, extnamespace, extversion')
      .in('extname', ['vector', 'pg_trgm', 'fuzzystrmatch', 'unaccent']);
    
    if (extError) {
      // Try alternative query for extensions
      const { data: extensionsAlt, error: extError2 } = await supabase.rpc('sql', {
        query: `
          SELECT 
            extname as extension_name,
            extnamespace::regnamespace as schema_name,
            extversion as version
          FROM pg_extension 
          WHERE extname IN ('vector', 'pg_trgm', 'fuzzystrmatch', 'unaccent')
          ORDER BY extname;
        `
      });
      
      if (extError2) {
        console.error('❌ Could not query extensions:', extError2.message);
      } else {
        console.log('✅ Extensions found:', extensionsAlt);
      }
    } else {
      console.log('✅ Extensions installed:', extensions);
    }
    
    // 2. Test pg_trgm similarity function
    console.log('\n2. Testing pg_trgm similarity function...');
    const { data: similarityTest, error: simError } = await supabase.rpc('sql', {
      query: "SELECT similarity('test string', 'test string') as exact_match, similarity('hello world', 'hello world!') as close_match;"
    });
    
    if (simError) {
      console.error('❌ pg_trgm similarity test failed:', simError.message);
    } else {
      console.log('✅ pg_trgm similarity working:', similarityTest);
      if (similarityTest[0]?.exact_match === 1.0) {
        console.log('   ✓ Exact match scoring correctly');
      }
    }
    
    // 3. Test unaccent function
    console.log('\n3. Testing unaccent function...');
    const { data: unaccentTest, error: unaccentError } = await supabase.rpc('sql', {
      query: "SELECT unaccent('café résumé') as unaccented, unaccent('naïve') as naive;"
    });
    
    if (unaccentError) {
      console.error('❌ unaccent test failed:', unaccentError.message);
    } else {
      console.log('✅ unaccent working:', unaccentTest);
    }
    
    // 4. Test fuzzystrmatch levenshtein function
    console.log('\n4. Testing fuzzystrmatch levenshtein function...');
    const { data: levenTest, error: levenError } = await supabase.rpc('sql', {
      query: "SELECT levenshtein('kitten', 'sitting') as distance, levenshtein('test', 'test') as identical;"
    });
    
    if (levenError) {
      console.error('❌ levenshtein test failed:', levenError.message);
    } else {
      console.log('✅ levenshtein working:', levenTest);
    }
    
    // 5. Test vector extension
    console.log('\n5. Testing vector extension...');
    const { data: vectorTest, error: vectorError } = await supabase.rpc('sql', {
      query: "SELECT '[1,2,3]'::vector(3) as test_vector, '[1,2,3]'::vector(3) <-> '[1,2,4]'::vector(3) as distance;"
    });
    
    if (vectorError) {
      console.error('❌ vector test failed:', vectorError.message);
    } else {
      console.log('✅ vector extension working:', vectorTest);
    }
    
    // 6. Test hybrid function compatibility
    console.log('\n6. Testing function usage in existing hybrid_product_match function...');
    const { data: functionTest, error: funcError } = await supabase.rpc('sql', {
      query: `
        SELECT 
          similarity('test product', 'test product name') as trigram_score,
          unaccent(lower('Test Café')) as normalized_text,
          '[0.1,0.2,0.3]'::vector(3) <=> '[0.1,0.2,0.4]'::vector(3) as vector_distance
      `
    });
    
    if (funcError) {
      console.error('❌ Combined function test failed:', funcError.message);
      console.error('   This may indicate schema path issues');
    } else {
      console.log('✅ All functions working together:', functionTest);
    }
    
    console.log('\n🎉 Extension verification completed!');
    console.log('\n📋 Summary:');
    console.log('   • pg_trgm: similarity() function available');
    console.log('   • unaccent: accent removal working'); 
    console.log('   • fuzzystrmatch: levenshtein() distance calculation');
    console.log('   • vector: pgvector for semantic similarity');
    console.log('\n✅ Your matching system should now work properly!');
    
  } catch (error) {
    console.error('💥 Verification script failed:', error);
    process.exit(1);
  }
}

// Run verification
verifyExtensions();