-- Phase 1: Diagnose auth.uid() function behavior
-- This will help us understand exactly what's happening with auth context

-- First, ensure RLS is disabled so we can test safely
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 1. Test if auth functions are available at all
SELECT 'Testing auth function availability:' as test;
SELECT 
    'auth.uid() function test' as test_name,
    auth.uid() as auth_uid_result,
    current_user as current_db_user,
    current_role as current_db_role;

-- 2. Check what user we expect to see
SELECT 'Expected user data:' as test;
SELECT 
    'Expected user from profiles' as test_name,
    id as expected_uuid,
    email,
    full_name
FROM profiles 
WHERE email = 'justin@pathopt.com';

-- 3. Create a simple test function to verify auth context
CREATE OR REPLACE FUNCTION test_auth_context()
RETURNS TABLE(
    auth_uid_value UUID,
    auth_uid_is_null BOOLEAN,
    user_exists BOOLEAN,
    profile_match BOOLEAN
) 
SECURITY DEFINER 
LANGUAGE plpgsql
AS $$
DECLARE
    current_auth_uid UUID;
    expected_user_id UUID;
BEGIN
    -- Get auth.uid()
    current_auth_uid := auth.uid();
    
    -- Get expected user ID
    SELECT id INTO expected_user_id 
    FROM profiles 
    WHERE email = 'justin@pathopt.com';
    
    RETURN QUERY SELECT 
        current_auth_uid,
        (current_auth_uid IS NULL),
        (expected_user_id IS NOT NULL),
        (current_auth_uid = expected_user_id);
END;
$$;

-- 4. Test the function (this will show NULL since we're not authenticated in SQL context)
SELECT 'Auth context test (will show NULL in SQL editor):' as test;
SELECT * FROM test_auth_context();

-- 5. Create a simple policy to test auth.uid() behavior
SELECT 'Creating test RLS policy...' as step;

-- Enable RLS temporarily
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create the simplest possible policy for testing
CREATE POLICY "test_auth_uid_policy" ON profiles
    FOR SELECT
    TO authenticated
    USING (true);  -- Allow all for now, we'll check auth.uid() separately

-- 6. Show the created policy
SELECT 'Test policy created:' as step;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles' AND policyname = 'test_auth_uid_policy';

SELECT 'Phase 1 diagnostic complete - now test login in browser!' as status;