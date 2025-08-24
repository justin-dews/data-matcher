-- Comprehensive debug of the 500 error
-- This will show us exactly what's happening

-- 1. Check auth.users table
SELECT 'AUTH USERS CHECK:' as section;
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'justin@pathopt.com';

-- 2. Check profiles table (as service role - bypasses RLS)
SELECT 'PROFILES TABLE CHECK (bypassing RLS):' as section;
SELECT id, organization_id, email, full_name, role, created_at
FROM profiles 
WHERE email = 'justin@pathopt.com';

-- 3. Check organizations table
SELECT 'ORGANIZATIONS CHECK:' as section;
SELECT id, name, slug, created_at FROM organizations;

-- 4. Check if there's a mismatch between auth.users.id and profiles.id
SELECT 'ID MISMATCH CHECK:' as section;
SELECT 
    u.id as auth_user_id,
    p.id as profile_id,
    u.email,
    CASE 
        WHEN u.id = p.id THEN 'MATCH ✅' 
        ELSE 'MISMATCH ❌' 
    END as id_status
FROM auth.users u
LEFT JOIN profiles p ON u.email = p.email
WHERE u.email = 'justin@pathopt.com';

-- 5. Check current RLS policies
SELECT 'CURRENT RLS POLICIES:' as section;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles';

-- 6. Check if RLS is enabled
SELECT 'RLS STATUS:' as section;
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';

-- 7. Manually test the RLS policy logic
SELECT 'RLS POLICY TEST:' as section;
SELECT 
    id,
    email,
    full_name,
    (id = (SELECT id FROM auth.users WHERE email = 'justin@pathopt.com')) as policy_would_match
FROM profiles 
WHERE email = 'justin@pathopt.com';

-- 8. Check for any profile duplicates
SELECT 'DUPLICATE CHECK:' as section;
SELECT email, count(*) as profile_count
FROM profiles 
WHERE email = 'justin@pathopt.com'
GROUP BY email;

SELECT 'Comprehensive debug complete!' as status;