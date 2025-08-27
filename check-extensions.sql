-- Check what extensions are available and installed in Supabase
SELECT 
    name,
    installed_version,
    default_version,
    comment
FROM pg_available_extensions 
WHERE name IN ('pg_trgm', 'fuzzystrmatch', 'unaccent', 'vector')
ORDER BY name;

-- Check what extensions are currently installed
SELECT 
    extname as extension_name,
    extversion as version,
    nspname as schema
FROM pg_extension 
JOIN pg_namespace ON pg_extension.extnamespace = pg_namespace.oid
WHERE extname IN ('pg_trgm', 'fuzzystrmatch', 'unaccent', 'vector');

-- Test if similarity function exists (this should tell us if pg_trgm is really working)
SELECT proname, pronamespace::regnamespace 
FROM pg_proc 
WHERE proname = 'similarity';

-- Test if levenshtein function exists (this should tell us if fuzzystrmatch is really working)
SELECT proname, pronamespace::regnamespace 
FROM pg_proc 
WHERE proname = 'levenshtein';