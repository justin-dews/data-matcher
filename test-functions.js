#!/usr/bin/env node

/**
 * Test script for PathoptMatch Edge Functions
 * 
 * Usage:
 *   node test-functions.js embed-text
 *   node test-functions.js parse-pdf
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

async function testEmbedText() {
  console.log('🧠 Testing embed-text function...');
  
  const testData = {
    texts: [
      'High-quality stainless steel screws M6x25mm',
      'Industrial grade aluminum brackets set of 4',
      'Premium copper wire 12AWG 100ft roll'
    ]
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/embed-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Embed-text function working!');
      console.log(`   Generated ${result.data.embeddings.length} embeddings`);
      console.log(`   Token usage: ${result.data.usage.total_tokens} tokens`);
    } else {
      console.log('❌ Embed-text function failed:', result.error);
    }
  } catch (error) {
    console.log('❌ Error testing embed-text:', error.message);
  }
}

async function testParsePdf() {
  console.log('📄 Testing parse-pdf function...');
  console.log('⚠️  Note: This requires a valid document_id and file_path in Supabase Storage');
  
  const testData = {
    document_id: 'test-document-id',
    file_path: 'test/sample.pdf'
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/parse-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Parse-pdf function working!');
      console.log(`   Extracted ${result.data.line_items.length} line items`);
      console.log('   Sample line item:', result.data.line_items[0]);
    } else {
      console.log('❌ Parse-pdf function failed:', result.error);
      if (result.details) console.log('   Details:', result.details);
    }
  } catch (error) {
    console.log('❌ Error testing parse-pdf:', error.message);
  }
}

async function main() {
  const functionName = process.argv[2];
  
  if (!functionName) {
    console.log('Usage: node test-functions.js [embed-text|parse-pdf]');
    process.exit(1);
  }

  console.log(`Testing PathoptMatch Edge Functions`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log('');

  switch (functionName) {
    case 'embed-text':
      await testEmbedText();
      break;
    case 'parse-pdf':
      await testParsePdf();
      break;
    default:
      console.log('Unknown function:', functionName);
      console.log('Available functions: embed-text, parse-pdf');
  }
}

main().catch(console.error);