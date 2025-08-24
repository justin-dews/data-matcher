-- FINAL FIX: Remove ALL conflicting policies and create ONE correct policy

-- 1. Drop ALL profiles policies (they're conflicting)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "profile_access_policy" ON profiles;  
DROP POLICY IF EXISTS "profiles_org_access" ON profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON profiles;
DROP POLICY IF EXISTS "profiles_service_role" ON profiles;

-- 2. Create ONE simple, working policy
CREATE POLICY "profiles_user_access" ON profiles
    FOR ALL 
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 3. Keep service role access for admin operations
CREATE POLICY "profiles_service_role_access" ON profiles
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. Verify final policies
SELECT 
    policyname, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;