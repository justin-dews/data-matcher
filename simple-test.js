#!/usr/bin/env node

/**
 * Simple test to check edge function response format
 */

console.log('🧪 Simple Edge Function Test');
console.log('============================');

// Test with missing parameters to see the error format
const testPayload = {
  // Missing document_id and file_path intentionally
};

console.log('Testing with empty payload to see error format...');
console.log('Expected: 400 error with "Missing required fields" message');

const https = require('https');

const payload = JSON.stringify(testPayload);

const options = {
  hostname: 'theattidfeqxyaexiqwj.supabase.co',
  port: 443,
  path: '/functions/v1/parse-pdf',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length,
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQzNTU4NDIsImV4cCI6MjAzOTkzMTg0Mn0.PQnqcyQxmPmTTyMb7DjILHLvM7TLBvGDRD6Xls1DV7A'
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
      console.log('Parsed response:', JSON.stringify(parsed, null, 2));
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