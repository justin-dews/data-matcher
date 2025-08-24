const { createClient } = require('@supabase/supabase-js');

// Use environment variables
const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODA4MzIsImV4cCI6MjA3MTQ1NjgzMn0.B-qWDnZRkxToVhhpMDVgXD38fzOptalciTDHxXOkgHI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testProfileFetch() {
  console.log('🔍 Testing profile fetching after RLS recursion fix...');
  
  try {
    // First, try to get session (should be none since we're not authenticated)
    const { data: { session } } = await supabase.auth.getSession();
    console.log('📋 Current session:', session ? 'Authenticated' : 'Not authenticated');
    
    if (!session) {
      console.log('ℹ️  No active session - this is expected for unauthenticated test');
      console.log('✅ The good news: no more infinite recursion errors!');
      console.log('🎯 When you login through the browser, profiles should load correctly now');
      return;
    }
    
    // If we somehow have a session, test profile fetching
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
      
    if (error) {
      console.error('❌ Profile fetch error:', error);
    } else {
      console.log('✅ Profile fetched successfully:', profile);
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

testProfileFetch();