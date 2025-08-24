-- COMPREHENSIVE RLS AUDIT SCRIPT
-- Phase 1.1: Complete Table-by-Table RLS Status Documentation
-- 
-- This script audits all core tables for RLS configuration, policies, 
-- data distribution, and identifies issues blocking multi-tenant functionality

-- =============================================================================
-- SECTION 1: TABLE STRUCTURE AND RLS STATUS AUDIT
-- =============================================================================

CREATE OR REPLACE VIEW rls_table_audit AS
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    -- Check if organization_id column exists
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = schemaname 
        AND table_name = tablename 
        AND column_name = 'organization_id'
    ) as has_organization_id,
    -- Count total rows
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_schema = schemaname AND table_name = tablename) as table_exists
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN (
    'organizations', 'profiles', 'products', 'documents', 
    'line_items', 'matches', 'competitor_aliases', 
    'product_embeddings', 'activity_log', 'settings'
)
ORDER BY tablename;

-- =============================================================================
-- SECTION 2: RLS POLICIES AUDIT
-- =============================================================================

CREATE OR REPLACE VIEW rls_policies_audit AS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,  -- Command: ALL, SELECT, INSERT, UPDATE, DELETE
    qual, -- USING clause
    with_check -- WITH CHECK clause
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN (
    'organizations', 'profiles', 'products', 'documents', 
    'line_items', 'matches', 'competitor_aliases', 
    'product_embeddings', 'activity_log', 'settings'
)
ORDER BY tablename, policyname;

-- =============================================================================
-- SECTION 3: ORGANIZATION DATA DISTRIBUTION ANALYSIS
-- =============================================================================

-- Check data distribution across organizations for tables with organization_id
DO $$
DECLARE
    table_name TEXT;
    sql_query TEXT;
    result_record RECORD;
    table_list TEXT[] := ARRAY[
        'products', 'documents', 'line_items', 'matches', 
        'competitor_aliases', 'product_embeddings', 'activity_log', 'settings'
    ];
BEGIN
    RAISE NOTICE '=== ORGANIZATION DATA DISTRIBUTION ANALYSIS ===';
    
    FOREACH table_name IN ARRAY table_list
    LOOP
        -- Check if table exists and has organization_id column
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = table_name
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = table_name 
            AND column_name = 'organization_id'
        ) THEN
            sql_query := format('
                SELECT 
                    ''%s'' as table_name,
                    organization_id,
                    COUNT(*) as record_count
                FROM %I 
                GROUP BY organization_id 
                ORDER BY record_count DESC
            ', table_name, table_name);
            
            RAISE NOTICE 'Table: %', table_name;
            FOR result_record IN EXECUTE sql_query
            LOOP
                RAISE NOTICE '  Org ID: % | Records: %', 
                    COALESCE(result_record.organization_id::TEXT, 'NULL'), 
                    result_record.record_count;
            END LOOP;
        ELSE
            RAISE NOTICE 'Table: % - Missing or no organization_id column', table_name;
        END IF;
    END LOOP;
END $$;

-- =============================================================================
-- SECTION 4: FOREIGN KEY CONSTRAINTS AUDIT
-- =============================================================================

SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
    AND tc.table_name IN (
        'organizations', 'profiles', 'products', 'documents', 
        'line_items', 'matches', 'competitor_aliases', 
        'product_embeddings', 'activity_log', 'settings'
    )
ORDER BY tc.table_name, tc.constraint_name;

-- =============================================================================
-- SECTION 5: CRITICAL ISSUES IDENTIFICATION
-- =============================================================================

-- Check for tables without organization_id that should have it
SELECT 
    'MISSING_ORG_ID' as issue_type,
    table_name,
    'Table should have organization_id column for multi-tenancy' as description
FROM information_schema.tables t
WHERE t.table_schema = 'public'
    AND t.table_name IN (
        'products', 'documents', 'line_items', 'matches', 
        'competitor_aliases', 'product_embeddings', 'activity_log', 'settings'
    )
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = t.table_name 
        AND column_name = 'organization_id'
    );

-- Check for tables with RLS disabled that should have it enabled
SELECT 
    'RLS_DISABLED' as issue_type,
    tablename as table_name,
    'RLS should be enabled for multi-tenant security' as description
FROM pg_tables pt
WHERE pt.schemaname = 'public'
    AND pt.tablename IN (
        'products', 'documents', 'line_items', 'matches', 
        'competitor_aliases', 'product_embeddings', 'activity_log', 'settings'
    )
    AND NOT EXISTS (
        SELECT 1 FROM pg_tables pt2
        WHERE pt2.schemaname = pt.schemaname 
        AND pt2.tablename = pt.tablename
        AND pt2.rowsecurity = true
    );

-- Check for missing organization foreign key constraints
SELECT 
    'MISSING_ORG_FK' as issue_type,
    c.table_name,
    'Missing foreign key constraint to organizations table' as description
FROM information_schema.columns c
WHERE c.table_schema = 'public'
    AND c.table_name IN (
        'products', 'documents', 'line_items', 'matches', 
        'competitor_aliases', 'product_embeddings', 'activity_log', 'settings'
    )
    AND c.column_name = 'organization_id'
    AND NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = c.table_name
            AND kcu.column_name = 'organization_id'
    );

-- =============================================================================
-- SECTION 6: RLS POLICY EFFECTIVENESS TEST
-- =============================================================================

-- Test if policies are actually enforcing organization isolation
-- This section will be expanded based on audit findings

SELECT 
    'POLICY_TEST' as test_type,
    'Policies will be tested after audit completion' as status;

-- =============================================================================
-- SECTION 7: SUMMARY VIEWS FOR EASY REPORTING
-- =============================================================================

-- Create comprehensive audit summary view
CREATE OR REPLACE VIEW rls_audit_summary AS
SELECT 
    t.tablename,
    t.rls_enabled,
    t.has_organization_id,
    COALESCE(policy_count.count, 0) as policy_count,
    COALESCE(fk_count.count, 0) as foreign_key_count,
    CASE 
        WHEN NOT t.rls_enabled THEN 'CRITICAL: RLS Disabled'
        WHEN NOT t.has_organization_id THEN 'CRITICAL: Missing organization_id'
        WHEN COALESCE(policy_count.count, 0) = 0 THEN 'HIGH: No RLS Policies'
        WHEN COALESCE(fk_count.count, 0) = 0 AND t.has_organization_id THEN 'MEDIUM: Missing FK Constraint'
        ELSE 'OK'
    END as status,
    CASE 
        WHEN NOT t.rls_enabled THEN 'Enable RLS'
        WHEN NOT t.has_organization_id THEN 'Add organization_id column'
        WHEN COALESCE(policy_count.count, 0) = 0 THEN 'Create RLS policies'
        WHEN COALESCE(fk_count.count, 0) = 0 AND t.has_organization_id THEN 'Add FK constraint'
        ELSE 'Review and test existing setup'
    END as recommended_action
FROM rls_table_audit t
LEFT JOIN (
    SELECT tablename, COUNT(*) as count
    FROM pg_policies 
    WHERE schemaname = 'public'
    GROUP BY tablename
) policy_count ON t.tablename = policy_count.tablename
LEFT JOIN (
    SELECT tc.table_name, COUNT(*) as count
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    GROUP BY tc.table_name
) fk_count ON t.tablename = fk_count.table_name
ORDER BY 
    CASE 
        WHEN NOT t.rls_enabled THEN 1
        WHEN NOT t.has_organization_id THEN 2
        WHEN COALESCE(policy_count.count, 0) = 0 THEN 3
        ELSE 4
    END,
    t.tablename;

-- =============================================================================
-- RUN THE AUDIT REPORT
-- =============================================================================

\echo '================================================================================'
\echo 'RLS COMPREHENSIVE AUDIT REPORT'
\echo 'Phase 1.1: Complete Table-by-Table RLS Status Documentation'
\echo '================================================================================'

\echo ''
\echo '1. TABLE STRUCTURE AND RLS STATUS:'
SELECT * FROM rls_table_audit;

\echo ''
\echo '2. EXISTING RLS POLICIES:'
SELECT * FROM rls_policies_audit;

\echo ''
\echo '3. FOREIGN KEY CONSTRAINTS:'
SELECT 
    table_name,
    constraint_name,
    column_name,
    foreign_table_name,
    foreign_column_name 
FROM (
    SELECT 
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'public'
        AND tc.table_name IN (
            'organizations', 'profiles', 'products', 'documents', 
            'line_items', 'matches', 'competitor_aliases', 
            'product_embeddings', 'activity_log', 'settings'
        )
) fk_data
ORDER BY table_name, constraint_name;

\echo ''
\echo '4. CRITICAL ISSUES IDENTIFIED:'
(
    SELECT * FROM (
        SELECT 
            'MISSING_ORG_ID' as issue_type,
            table_name,
            'Table should have organization_id column' as description
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
            AND t.table_name IN (
                'products', 'documents', 'line_items', 'matches', 
                'competitor_aliases', 'product_embeddings', 'activity_log', 'settings'
            )
            AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = t.table_name 
                AND column_name = 'organization_id'
            )
    ) missing_org_id
)
UNION ALL
(
    SELECT * FROM (
        SELECT 
            'RLS_DISABLED' as issue_type,
            tablename as table_name,
            'RLS should be enabled for security' as description
        FROM pg_tables pt
        WHERE pt.schemaname = 'public'
            AND pt.tablename IN (
                'products', 'documents', 'line_items', 'matches', 
                'competitor_aliases', 'product_embeddings', 'activity_log', 'settings'
            )
            AND pt.rowsecurity = false
    ) rls_disabled
)
UNION ALL
(
    SELECT * FROM (
        SELECT 
            'MISSING_ORG_FK' as issue_type,
            c.table_name,
            'Missing FK constraint to organizations' as description
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
            AND c.table_name IN (
                'products', 'documents', 'line_items', 'matches', 
                'competitor_aliases', 'product_embeddings', 'activity_log', 'settings'
            )
            AND c.column_name = 'organization_id'
            AND NOT EXISTS (
                SELECT 1 
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_name = c.table_name
                    AND kcu.column_name = 'organization_id'
            )
    ) missing_fk
)
ORDER BY issue_type, table_name;

\echo ''
\echo '5. AUDIT SUMMARY (Priority Order):'
SELECT * FROM rls_audit_summary;

\echo ''
\echo '================================================================================'
\echo 'END OF RLS AUDIT REPORT'
\echo 'Next Step: Document findings and create Phase 1.2 policy design based on this audit'
\echo '================================================================================'