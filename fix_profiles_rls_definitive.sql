-- DEFINITIVE FIX for profiles table RLS infinite recursion
-- This will completely reset and properly configure the profiles RLS policies

-- 1. Show current problematic policies
SELECT 'Current RLS policies on profiles table:' as step;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 2. DROP ALL existing policies on profiles table
SELECT 'Dropping all existing profiles policies...' as step;
DROP POLICY IF EXISTS "Users can access their own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_policy" ON profiles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- 3. Verify no policies remain
SELECT 'Verifying no policies remain:' as step;
SELECT count(*) as remaining_policies FROM pg_policies WHERE tablename = 'profiles';

-- 4. Create ONE simple, correct policy
SELECT 'Creating new simple RLS policy...' as step;
CREATE POLICY "users_own_profile_access" ON profiles
    FOR ALL 
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 5. Verify the new policy
SELECT 'New policy created:' as step;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles';

-- 6. Test profile access with the user ID
SELECT 'Testing profile access:' as step;
SELECT 
    'Profile exists for user' as test,
    id,
    email,
    full_name,
    role
FROM profiles 
WHERE email = 'justin@pathopt.com';

-- 7. Final verification
SELECT 'RLS policy fix complete - should eliminate infinite recursion!' as status;