// Test script to verify environment variable access
// Run this in your browser console or as a standalone test

async function testEnvironmentVariable() {
  try {
    const response = await fetch('https://theattidfeqxyaexiqwj.supabase.co/functions/v1/parse-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_ANON_KEY_HERE', // Replace with your anon key
      },
      body: JSON.stringify({
        document_id: 'test-env-check',
        file_path: 'test/dummy.pdf'
      })
    });

    const result = await response.text();
    console.log('Response:', result);
    
    // If you see "LLAMAPARSE_API_KEY environment variable is required"
    // then the env var is not set properly
    // If you see a different error (like file not found), the env var is working
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Uncomment to run the test
// testEnvironmentVariable();