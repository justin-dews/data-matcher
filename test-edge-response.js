#!/usr/bin/env node

/**
 * Test edge function with the exact parameters from the failed request
 */

require('dotenv').config({ path: '.env.local' });

console.log('🧪 Testing edge function with actual parameters...');

const https = require('https');

const payload = JSON.stringify({
  document_id: 'fa230f2b-0af8-4293-b67a-51eb782be9e0',
  file_path: 'b903b88d-e667-4dde-94ff-79dbbb1fcb38/1755907529469-bxaiyg.pdf',
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

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Status Text: ${res.statusText}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📋 Full Response Body:');
    console.log(data);
    
    try {
      const parsed = JSON.parse(data);
      console.log('\n🔍 Parsed Response:');
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.error) {
        console.log('\n❌ Error Details:', parsed.error);
        if (parsed.details) {
          console.log('📝 Additional Details:', parsed.details);
        }
      }
    } catch (e) {
      console.log('\n❌ Could not parse response as JSON');
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

console.log('📤 Sending request with payload:');
console.log(JSON.stringify(JSON.parse(payload), null, 2));

req.write(payload);
req.end();