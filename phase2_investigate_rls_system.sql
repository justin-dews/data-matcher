-- Phase 2: Investigate RLS configuration and system dependencies
-- Since even USING (true) fails, something is wrong with RLS itself

-- 1. Check if there are any other policies interfering
SELECT 'ALL RLS policies in database:' as check;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
ORDER BY schemaname, tablename, policyname;

-- 2. Check what roles/users exist and their permissions
SELECT 'Database roles and permissions:' as check;
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication 
FROM pg_roles 
WHERE rolname IN ('postgres', 'authenticated', 'anon', 'service_role', 'supabase_admin')
ORDER BY rolname;

-- 3. Check if there are any triggers or functions that might interfere
SELECT 'Triggers on profiles table:' as check;
SELECT trigger_name, event_manipulation, action_timing, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'profiles';

-- 4. Check if there are any foreign key constraints that might cause issues
SELECT 'Foreign key constraints on profiles:' as check;
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'profiles';

-- 5. Check if the organizations table has RLS that might be interfering
SELECT 'Organizations table RLS status:' as check;
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'organizations';

SELECT 'Organization RLS policies:' as check;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'organizations';

-- 6. Test a completely different approach - disable all RLS policies temporarily
SELECT 'Disabling RLS to isolate the issue...' as step;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Drop the test policy
DROP POLICY IF EXISTS "test_auth_uid_policy" ON profiles;

-- 7. Check if there are any other tables with RLS that might be causing cascade issues
SELECT 'All tables with RLS enabled:' as check;
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE rowsecurity = true
ORDER BY schemaname, tablename;

SELECT 'Phase 2 investigation complete - try login now with RLS disabled!' as status;