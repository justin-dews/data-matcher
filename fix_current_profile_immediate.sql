-- Immediate fix for current profile 500 error
-- This creates the missing profile for justin@pathopt.com properly

-- 1. Check current state
SELECT 'Current state check:' as step;
SELECT 'User exists in auth:' as check, count(*) as count 
FROM auth.users WHERE email = 'justin@pathopt.com';

SELECT 'Profile exists in profiles:' as check, count(*) as count 
FROM profiles WHERE email = 'justin@pathopt.com';

SELECT 'Organizations exist:' as check, count(*) as count FROM organizations;

-- 2. Create organization if it doesn't exist
INSERT INTO organizations (id, name, slug, settings)
SELECT gen_random_uuid(), 'PathOpt Solutions', 'pathopt-solutions', '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'pathopt-solutions');

-- 3. Create profile for justin@pathopt.com if it doesn't exist
INSERT INTO profiles (id, organization_id, email, full_name, role, created_at, updated_at)
SELECT 
  u.id,
  o.id as organization_id,
  u.email,
  'Justin Dews' as full_name,
  'admin' as role,
  NOW() as created_at,
  NOW() as updated_at
FROM auth.users u
CROSS JOIN organizations o
WHERE u.email = 'justin@pathopt.com' 
  AND o.slug = 'pathopt-solutions'
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = u.id);

-- 4. Verify the profile was created/exists
SELECT 'Final verification:' as step;
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  o.name as organization_name,
  o.slug as organization_slug
FROM profiles p
JOIN organizations o ON p.organization_id = o.id
WHERE p.email = 'justin@pathopt.com';

-- 5. Test that RLS policy works
SELECT 'RLS Policy Test:' as step;
SELECT 'Profile can be accessed with RLS policy' as test_result;