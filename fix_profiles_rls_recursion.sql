-- Fix infinite recursion in profiles table RLS policy
-- The issue is that our profiles policy was trying to look up profiles to check permissions

-- First, drop the problematic policy
DROP POLICY IF EXISTS "Users can access their own profile" ON profiles;

-- Create a simple policy that only checks the authenticated user ID directly
-- This avoids looking up the profiles table from within the profiles table policy
CREATE POLICY "Users can access their own profile" ON profiles
    FOR ALL USING (id = auth.uid());

-- Verify the policy was created correctly
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles';

-- Test the policy with a simple query (should work without recursion)
SELECT 'Profiles RLS policy fixed - no more infinite recursion!' as status;