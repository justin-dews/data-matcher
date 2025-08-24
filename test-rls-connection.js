const { createClient } = require('@supabase/supabase-js');

// Use environment variables
const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODA4MzIsImV4cCI6MjA3MTQ1NjgzMn0.B-qWDnZRkxToVhhpMDVgXD38fzOptalciTDHxXOkgHI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRLSConnection() {
  console.log('🔍 Testing RLS policies after implementation...');
  
  try {
    // Test basic connection
    const { data: connection, error: connError } = await supabase
      .from('products')
      .select('count', { count: 'exact' })
      .limit(0);
      
    if (connError) {
      console.error('❌ Connection error:', connError.message);
      return;
    }
    
    console.log('✅ Database connected successfully');
    console.log('📦 Total products in database:', connection.count);
    
    // Test RLS - should return 0 without proper authentication
    const { data: products, error } = await supabase
      .from('products')
      .select('id, sku, name')
      .limit(5);
      
    if (error) {
      console.error('❌ RLS blocking unauthenticated access (expected):', error.message);
      console.log('✅ RLS policies are working correctly - authentication required');
    } else {
      console.log('⚠️ Products accessible without auth:', products.length);
      if (products.length > 0) {
        console.log('⚠️ This indicates RLS may not be working properly');
        console.log('First product:', products[0].sku, '-', products[0].name);
      }
    }
    
    // Test that the database structure is intact
    console.log('\n🏗️ Database structure validation:');
    
    const { data: orgCount } = await supabase
      .from('organizations')
      .select('count', { count: 'exact' })
      .limit(0);
    
    const { data: profileCount } = await supabase
      .from('profiles')  
      .select('count', { count: 'exact' })
      .limit(0);
      
    console.log('📊 Organizations:', orgCount?.count || 0);
    console.log('👤 Profiles:', profileCount?.count || 0);
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

testRLSConnection();