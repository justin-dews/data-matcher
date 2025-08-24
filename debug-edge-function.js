#!/usr/bin/env node

/**
 * Debug the parse-pdf edge function issue
 */

const https = require('https');

async function testEdgeFunction() {
  console.log('🧪 Testing parse-pdf edge function...');
  
  const payload = JSON.stringify({
    document_id: '00000000-0000-0000-0000-000000000001',
    file_path: 'test/sample.pdf',
    preset: 'invoice'
  });
  
  const options = {
    hostname: 'theattidfeqxyaexiqwj.supabase.co',
    port: 443,
    path: '/functions/v1/parse-pdf',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response body:', data);
        resolve({ status: res.statusCode, body: data });
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });
    
    req.write(payload);
    req.end();
  });
}

// Check if we have the required env var
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('You can find this in your Supabase project settings');
  process.exit(1);
}

testEdgeFunction()
  .then((result) => {
    console.log('✅ Test completed');
    if (result.status === 400) {
      console.log('🔍 400 error - check the response body above for details');
    }
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
  });