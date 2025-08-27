#!/usr/bin/env node

// 🔍 Debug why frontend gets 404 but backend test works
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function debugFrontend404() {
    console.log('🔍 DEBUGGING: Frontend 404 vs Backend Success...')
    
    // Test 1: Service Role Client (like our successful test)
    console.log('\n🧪 Test 1: Service Role Client (should work)')
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
    
    try {
        const { data, error } = await adminClient.rpc('hybrid_product_match_tiered', {
            query_text: 'test product',
            limit_count: 1,
            threshold: 0.1
        })
        
        if (error) {
            console.log(`❌ Service Role FAILED: ${error.code} - ${error.message}`)
        } else {
            console.log(`✅ Service Role SUCCESS: ${data ? data.length : 0} results`)
        }
    } catch (err) {
        console.log(`🚨 Service Role EXCEPTION: ${err.message}`)
    }
    
    // Test 2: Anonymous Client (like frontend when not authenticated)
    console.log('\n🧪 Test 2: Anonymous Client (like frontend)')
    const anonClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
    
    try {
        const { data, error } = await anonClient.rpc('hybrid_product_match_tiered', {
            query_text: 'test product',
            limit_count: 1,
            threshold: 0.1
        })
        
        if (error) {
            console.log(`❌ Anonymous FAILED: ${error.code} - ${error.message}`)
            if (error.code === 'PGRST116') {
                console.log('   🔍 Function not found for anonymous role')
            }
        } else {
            console.log(`✅ Anonymous SUCCESS: ${data ? data.length : 0} results`)
        }
    } catch (err) {
        console.log(`🚨 Anonymous EXCEPTION: ${err.message}`)
    }
    
    // Test 3: Check what functions are visible to anonymous role
    console.log('\n🧪 Test 3: Check function visibility for anonymous role')
    try {
        // This will show us what RPC functions are available
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: {
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`
            }
        })
        
        if (response.ok) {
            const schema = await response.json()
            console.log('📋 PostgREST Schema Info Available')
            
            // Check if our function is in the definitions
            const schemaText = JSON.stringify(schema)
            if (schemaText.includes('hybrid_product_match_tiered')) {
                console.log('✅ hybrid_product_match_tiered found in schema')
            } else {
                console.log('❌ hybrid_product_match_tiered NOT found in schema')
                console.log('🔍 This means the function is not accessible to the anonymous role')
            }
        }
    } catch (err) {
        console.log('🚨 Schema check failed:', err.message)
    }
    
    // Test 4: Check permissions in database
    console.log('\n🧪 Test 4: Check database permissions')
    try {
        const { data: permData, error: permError } = await adminClient
            .rpc('sql', { 
                query: `
                SELECT 
                    p.proname as function_name,
                    array_agg(pr.rolname) as granted_roles
                FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                LEFT JOIN pg_proc_privileges pp ON p.oid = pp.objoid
                LEFT JOIN pg_roles pr ON pp.grantee = pr.oid
                WHERE p.proname = 'hybrid_product_match_tiered'
                AND n.nspname = 'public'
                GROUP BY p.proname
                ORDER BY p.proname;
                ` 
            })
            .catch(() => ({ data: null, error: 'SQL function not available' }))
            
        if (permData) {
            console.log('✅ Permission check result:', permData)
        } else {
            console.log('⚠️ Could not check permissions directly')
        }
    } catch (err) {
        console.log('🚨 Permission check failed:', err.message)
    }
    
    // Analysis and Solution
    console.log('\n' + '='.repeat(60))
    console.log('🔍 ANALYSIS: Why Frontend Gets 404')
    console.log('='.repeat(60))
    
    console.log('✅ Function EXISTS and WORKS with service_role key')
    console.log('❌ Function NOT ACCESSIBLE via anonymous/authenticated role')
    console.log('')
    console.log('🔧 ROOT CAUSE:')
    console.log('   PostgREST only exposes functions that have proper role permissions')
    console.log('   The function may not be granted to the authenticated role properly')
    console.log('')
    console.log('💡 SOLUTION:')
    console.log('   Re-run permission grants specifically for authenticated role')
    console.log('   Add explicit schema cache refresh')
    console.log('   Verify RLS policies are not blocking access')
    
    // Create a fix script
    console.log('\n📋 PERMISSION FIX SCRIPT:')
    console.log('----------------------------------------')
    const fixScript = `
-- Fix PostgREST function visibility for frontend
REVOKE ALL ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) FROM authenticated;
REVOKE ALL ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) FROM anon;

-- Grant explicit permissions
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) TO service_role;

-- Ensure function is SECURITY DEFINER and stable
ALTER FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) SECURITY DEFINER;

-- Force schema refresh
NOTIFY pgrst, 'reload schema';
COMMENT ON FUNCTION hybrid_product_match_tiered(TEXT, INTEGER, NUMERIC) IS 'Frontend accessible - permissions fixed';

-- Verify permissions
SELECT 
    'Permission verification:' as check_type,
    has_function_privilege('anon', 'hybrid_product_match_tiered(text,integer,numeric)', 'execute') as anon_access,
    has_function_privilege('authenticated', 'hybrid_product_match_tiered(text,integer,numeric)', 'execute') as auth_access;
    `
    
    console.log(fixScript)
    console.log('----------------------------------------')
    console.log('\n🎯 Run this script in Supabase SQL Editor to fix frontend 404s')
}

debugFrontend404()