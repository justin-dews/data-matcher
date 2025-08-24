-- Create a working RLS policy for profiles
-- The previous policy had issues with auth.uid() evaluation

-- 1. Re-enable RLS on profiles table
SELECT 'Re-enabling RLS...' as step;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing policies completely
SELECT 'Dropping existing policies...' as step;
DROP POLICY IF EXISTS "users_own_profile_access" ON profiles;
DROP POLICY IF EXISTS "Users can access their own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_policy" ON profiles;

-- 3. Create a simple, working policy
-- This policy uses a more explicit approach that should work properly
SELECT 'Creating working RLS policy...' as step;
CREATE POLICY "profile_access_policy" ON profiles
    FOR ALL 
    TO authenticated 
    USING (id::text = (current_setting('request.jwt.claims', true)::json ->> 'sub'))
    WITH CHECK (id::text = (current_setting('request.jwt.claims', true)::json ->> 'sub'));

-- 4. Verify the policy was created
SELECT 'Policy verification:' as step;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles';

-- 5. Verify RLS is enabled
SELECT 'RLS status:' as step;
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';

SELECT 'New RLS policy created - test login now!' as status;