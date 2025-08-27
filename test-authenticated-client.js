#!/usr/bin/env node

// 🔍 Test authenticated client vs anonymous client
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function testAuthenticatedClient() {
    console.log('🔍 Testing Authenticated vs Anonymous client differences...')
    
    // Test 1: Anonymous client (works in our tests)
    console.log('\n🧪 Test 1: Anonymous client')
    const anonClient = createClient(supabaseUrl, anonKey)
    
    try {
        const { data: anonData, error: anonError } = await anonClient.rpc('hybrid_product_match_tiered', {
            query_text: 'power probe',
            limit_count: 3,
            threshold: 0.2
        })
        
        if (anonError) {
            console.log(`❌ Anonymous FAILED: ${anonError.code} - ${anonError.message}`)
        } else {
            console.log(`✅ Anonymous SUCCESS: ${anonData ? anonData.length : 0} results`)
        }
    } catch (err) {
        console.log(`🚨 Anonymous EXCEPTION: ${err.message}`)
    }
    
    // Test 2: Service role client (admin)
    console.log('\n🧪 Test 2: Service role client (admin)')
    const adminClient = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
    
    try {
        const { data: adminData, error: adminError } = await adminClient.rpc('hybrid_product_match_tiered', {
            query_text: 'power probe',
            limit_count: 3,
            threshold: 0.2
        })
        
        if (adminError) {
            console.log(`❌ Admin FAILED: ${adminError.code} - ${adminError.message}`)
        } else {
            console.log(`✅ Admin SUCCESS: ${adminData ? adminData.length : 0} results`)
        }
    } catch (err) {
        console.log(`🚨 Admin EXCEPTION: ${err.message}`)
    }
    
    // Test 3: Simulate authenticated user
    console.log('\n🧪 Test 3: Check function permissions for authenticated role')
    
    try {
        // Check permissions directly in database
        const { data: permData, error: permError } = await adminClient
            .rpc('sql', { query: `
                SELECT 
                    'Function permissions check' as check_type,
                    has_function_privilege('anon', 'hybrid_product_match_tiered(text,integer,numeric)', 'execute') as anon_execute,
                    has_function_privilege('authenticated', 'hybrid_product_match_tiered(text,integer,numeric)', 'execute') as auth_execute,
                    has_function_privilege('service_role', 'hybrid_product_match_tiered(text,integer,numeric)', 'execute') as service_execute;
            ` })
            .catch(() => ({ data: null, error: 'SQL not available' }))
        
        if (permData && permData[0]) {
            const perms = permData[0]
            console.log('📋 Permission results:')
            console.log(`   🔓 anon role: ${perms.anon_execute ? '✅ CAN execute' : '❌ CANNOT execute'}`)
            console.log(`   🔐 authenticated role: ${perms.auth_execute ? '✅ CAN execute' : '❌ CANNOT execute'}`)
            console.log(`   🛡️  service_role: ${perms.service_execute ? '✅ CAN execute' : '❌ CANNOT execute'}`)
            
            if (!perms.auth_execute) {
                console.log('\n🚨 PROBLEM IDENTIFIED: authenticated role CANNOT execute function!')
                console.log('   This explains why browser (authenticated user) gets 404s')
                console.log('   while Node.js tests (anonymous) work')
            }
        } else {
            console.log('⚠️ Could not check permissions directly')
        }
    } catch (err) {
        console.log(`🚨 Permission check failed: ${err.message}`)
    }
    
    // Test 4: Check function existence in different schemas
    console.log('\n🧪 Test 4: Function visibility check')
    try {
        const { data: funcData, error: funcError } = await adminClient
            .from('pg_proc')
            .select(`
                proname,
                proargtypes,
                prokind,
                prosecdef,
                pg_namespace!inner(nspname)
            `)
            .eq('proname', 'hybrid_product_match_tiered')
            .limit(5)
            .catch(() => ({ data: null, error: 'Cannot query pg_proc' }))
        
        if (funcData) {
            console.log(`📊 Found ${funcData.length} function(s) named hybrid_product_match_tiered`)
            funcData.forEach((func, i) => {
                console.log(`   ${i+1}. Schema: ${func.pg_namespace?.nspname}, Security Definer: ${func.prosecdef}`)
            })
        }
    } catch (err) {
        console.log(`⚠️ Function visibility check failed: ${err.message}`)
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('🎯 DIAGNOSIS')
    console.log('='.repeat(60))
    console.log('If anonymous works but authenticated fails, the issue is:')
    console.log('1. ❌ Function permissions not granted to authenticated role')
    console.log('2. 🔧 Need to run: GRANT EXECUTE ON FUNCTION ... TO authenticated;')
    console.log('3. 🌐 Frontend uses authenticated user context, not anonymous')
    console.log('')
    console.log('💡 SOLUTION: Fix authenticated role permissions')
}

testAuthenticatedClient()