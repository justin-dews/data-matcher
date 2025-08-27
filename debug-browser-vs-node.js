#!/usr/bin/env node

// 🔍 Debug difference between browser and Node.js RPC calls
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function debugBrowserVsNode() {
    console.log('🔍 Debugging Browser vs Node.js RPC call differences...')
    
    // Create client exactly like browser does
    const browserClient = createClient(supabaseUrl, anonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    
    try {
        console.log('🧪 Test 1: Node.js client (should work)')
        const { data: nodeData, error: nodeError } = await browserClient.rpc('hybrid_product_match_tiered', {
            query_text: 'power probe',
            limit_count: 3,
            threshold: 0.2
        })
        
        if (nodeError) {
            console.log(`❌ Node.js FAILED: ${nodeError.code} - ${nodeError.message}`)
        } else {
            console.log(`✅ Node.js SUCCESS: ${nodeData ? nodeData.length : 0} results`)
        }
        
        console.log('\n🌐 Test 2: Checking raw HTTP request (like browser)')
        
        // Make direct HTTP request like browser would
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/hybrid_product_match_tiered`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                query_text: 'power probe',
                limit_count: 3,
                threshold: 0.2
            })
        })
        
        console.log(`📊 HTTP Response Status: ${response.status}`)
        console.log(`📊 HTTP Response Headers:`, Object.fromEntries(response.headers.entries()))
        
        if (response.status === 404) {
            console.log('❌ DIRECT HTTP REQUEST ALSO FAILS WITH 404')
            console.log('🔍 This confirms the function is not accessible via REST API')
            
            const errorText = await response.text()
            console.log('📄 Error response body:', errorText)
            
        } else if (response.status === 200) {
            const httpData = await response.json()
            console.log(`✅ DIRECT HTTP SUCCESS: ${httpData ? httpData.length : 0} results`)
        } else {
            console.log(`⚠️ HTTP Response ${response.status}:`, await response.text())
        }
        
        console.log('\n🔍 Test 3: Check function permissions directly')
        
        // Check function permissions via SQL
        const { data: permData, error: permError } = await browserClient.rpc('sql', {
            query: `
            SELECT 
                has_function_privilege('anon', 'hybrid_product_match_tiered(text,integer,numeric)', 'execute') as anon_can_execute,
                has_function_privilege('authenticated', 'hybrid_product_match_tiered(text,integer,numeric)', 'execute') as auth_can_execute;
            `
        }).catch(() => ({ data: null, error: 'SQL function not available' }))
        
        if (permData) {
            console.log('✅ Permission check result:', permData)
        } else {
            console.log('⚠️ Could not check permissions via SQL')
        }
        
        console.log('\n📋 ANALYSIS:')
        
        if (nodeError && response.status === 404) {
            console.log('❌ Both Node.js client AND direct HTTP fail')
            console.log('🔍 This means the function is not accessible via PostgREST at all')
            console.log('💡 Possible causes:')
            console.log('   1. Function signature still not recognized by PostgREST')
            console.log('   2. Permissions not properly granted to anon/authenticated roles')
            console.log('   3. PostgREST schema cache still not refreshed')
            console.log('   4. Function deployment had errors')
        } else if (!nodeError && response.status === 404) {
            console.log('🤔 Node.js client works but direct HTTP fails')
            console.log('   This suggests different authentication or client behavior')
        } else if (nodeError && response.status === 200) {
            console.log('🤔 Direct HTTP works but Node.js client fails')
            console.log('   This suggests client SDK issues')
        } else {
            console.log('✅ Both approaches work - issue may be browser-specific')
        }
        
    } catch (err) {
        console.log('🚨 Debug test failed:', err.message)
    }
}

debugBrowserVsNode()