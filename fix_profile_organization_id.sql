-- Fix the profile to reference the correct organization
-- The profile exists but has the wrong organization_id

-- 1. First, let's see what organizations exist
SELECT 'Current organizations:' as check;
SELECT id, name, slug FROM organizations;

-- 2. Update the profile to use the correct PathOpt Solutions organization
UPDATE profiles 
SET organization_id = (
    SELECT id FROM organizations WHERE slug = 'pathopt-solutions'
),
updated_at = NOW()
WHERE email = 'justin@pathopt.com' 
AND organization_id = '00000000-0000-0000-0000-000000000001';

-- 3. Verify the update worked
SELECT 'Profile after update:' as check;
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.organization_id,
    o.name as organization_name,
    o.slug as organization_slug
FROM profiles p
JOIN organizations o ON p.organization_id = o.id
WHERE p.email = 'justin@pathopt.com';

SELECT 'Profile organization fixed!' as status;