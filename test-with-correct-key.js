#!/usr/bin/env node

/**
 * Test edge function with correct service role key from .env.local
 */

require('dotenv').config({ path: '.env.local' });

console.log('🧪 Testing with correct service role key...');
console.log('Service key starts with:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...');

const https = require('https');

// Test with missing parameters first to verify auth works
const payload = JSON.stringify({
  // Missing document_id and file_path to trigger validation error
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

const req = https.request(options, (res) => {
  console.log(`\nStatus: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    try {
      const parsed = JSON.parse(data);
      console.log('\nParsed response:', JSON.stringify(parsed, null, 2));
      
      if (res.statusCode === 400 && parsed.error === 'Missing required fields: document_id and file_path') {
        console.log('✅ Authentication working! Got expected validation error.');
      } else if (res.statusCode === 401) {
        console.log('❌ Still getting auth error');
      } else {
        console.log('🤔 Unexpected response');
      }
    } catch (e) {
      console.log('Could not parse as JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(payload);
req.end();