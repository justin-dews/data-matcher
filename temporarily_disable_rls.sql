-- Temporarily disable RLS on profiles to test if that's the issue
-- We can re-enable it once we confirm this fixes the 500 error

-- 1. Check current RLS status
SELECT 'Current RLS status:' as check;
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';

-- 2. Temporarily disable RLS on profiles table
SELECT 'Disabling RLS on profiles table...' as action;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 3. Verify RLS is disabled
SELECT 'RLS status after disable:' as check;
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';

-- 4. Test profile access (should work now)
SELECT 'Testing profile access without RLS:' as test;
SELECT id, email, full_name, role, organization_id
FROM profiles 
WHERE email = 'justin@pathopt.com';

SELECT 'RLS temporarily disabled - test login now!' as status;