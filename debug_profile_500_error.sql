-- Debug and fix 500 error in profile fetching
-- This script will diagnose and fix the profile loading issue

-- 1. Check if the user profile exists
SELECT 'Checking if profile exists for justin@pathopt.com...' as step;
SELECT id, email, full_name, organization_id, role, created_at 
FROM auth.users 
WHERE email = 'justin@pathopt.com';

-- 2. Check if profile exists in public.profiles
SELECT 'Checking public.profiles table...' as step;
SELECT * FROM profiles 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'justin@pathopt.com');

-- 3. Check current RLS policies on profiles
SELECT 'Current RLS policies on profiles table:' as step;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles';

-- 4. Check if organizations table has data
SELECT 'Checking organizations table...' as step;
SELECT id, name, slug, created_at FROM organizations LIMIT 5;

-- 5. If profile doesn't exist, create it for the user
DO $$
DECLARE
    user_record RECORD;
    org_id UUID;
BEGIN
    -- Get the user record
    SELECT id, email INTO user_record 
    FROM auth.users 
    WHERE email = 'justin@pathopt.com';
    
    IF user_record.id IS NOT NULL THEN
        -- Check if profile already exists
        IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = user_record.id) THEN
            RAISE NOTICE 'Creating profile for user %', user_record.email;
            
            -- Check if PathOpt Solutions organization exists
            SELECT id INTO org_id 
            FROM organizations 
            WHERE slug = 'pathopt-solutions';
            
            -- If organization doesn't exist, create it
            IF org_id IS NULL THEN
                org_id := gen_random_uuid();
                INSERT INTO organizations (id, name, slug, settings) 
                VALUES (org_id, 'PathOpt Solutions', 'pathopt-solutions', '{}');
                RAISE NOTICE 'Created organization PathOpt Solutions with ID %', org_id;
            END IF;
            
            -- Create the profile
            INSERT INTO profiles (id, organization_id, email, full_name, role)
            VALUES (user_record.id, org_id, user_record.email, 'Justin Dews', 'admin');
            
            RAISE NOTICE 'Profile created successfully for %', user_record.email;
        ELSE
            RAISE NOTICE 'Profile already exists for %', user_record.email;
        END IF;
    ELSE
        RAISE NOTICE 'User % not found in auth.users', 'justin@pathopt.com';
    END IF;
END $$;

-- 6. Final verification
SELECT 'Final verification - Profile and organization data:' as step;
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role,
    o.name as organization_name,
    o.slug as organization_slug
FROM profiles p
JOIN organizations o ON p.organization_id = o.id
WHERE p.id IN (SELECT id FROM auth.users WHERE email = 'justin@pathopt.com');

SELECT 'Profile debugging complete!' as status;