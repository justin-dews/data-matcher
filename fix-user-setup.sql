-- Fix user setup by creating organization and profile records
-- This script should be run after a user signs up

-- First, create a test organization
INSERT INTO organizations (id, name, domain, subscription_tier, settings)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Test Organization', 
    'test.com',
    'free',
    '{}'
) ON CONFLICT (id) DO NOTHING;

-- Get the current user ID from auth.users (replace with actual user ID)
-- You can get this from the browser dev tools or by checking auth.users table

-- Example: Insert profile for user (replace USER_ID_HERE with actual user ID)
-- INSERT INTO profiles (id, organization_id, email, first_name, last_name, role)
-- VALUES (
--     'USER_ID_HERE',
--     '00000000-0000-0000-0000-000000000001', 
--     'test@test.com',
--     'Test',
--     'User',
--     'admin'
-- ) ON CONFLICT (id) DO NOTHING;

-- Check current users
SELECT 'Current users:' as info;
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- Check if organization exists
SELECT 'Organizations:' as info;
SELECT id, name FROM organizations;

-- Check profiles
SELECT 'Profiles:' as info;
SELECT id, email, organization_id FROM profiles;