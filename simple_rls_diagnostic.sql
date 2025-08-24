-- Simple RLS diagnostic - one query at a time to see actual results

-- Query 1: Show ALL RLS policies in the database
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
ORDER BY schemaname, tablename, policyname;