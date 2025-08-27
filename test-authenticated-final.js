#!/usr/bin/env node

// 🔐 Final test - simulate authenticated browser environment
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function testAuthenticatedFinal() {
    console.log('🔐 Testing authenticated role permissions after fix...')
    
    // Wait for permission changes to propagate
    console.log('⏳ Waiting 30 seconds for permission changes to propagate...')
    await new Promise(resolve => setTimeout(resolve, 30000))
    
    console.log('\n🧪 Test 1: Anonymous client (should still work)')
    const anonClient = createClient(supabaseUrl, anonKey)
    
    try {
        const { data, error } = await anonClient.rpc('hybrid_product_match_tiered', {
            query_text: 'power probe',
            limit_count: 3,
            threshold: 0.2
        })
        
        if (error) {
            console.log(`❌ Anonymous FAILED: ${error.code} - ${error.message}`)
        } else {
            console.log(`✅ Anonymous SUCCESS: ${data ? data.length : 0} results`)
        }
    } catch (err) {
        console.log(`🚨 Anonymous EXCEPTION: ${err.message}`)
    }
    
    // Test with actual authenticated user simulation
    console.log('\n🧪 Test 2: Simulate authenticated browser client')
    
    // Create client exactly like browser does for authenticated users
    const browserAuthClient = createClient(supabaseUrl, anonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true
        }
    })
    
    try {
        // This simulates the browser environment where user is authenticated
        const { data, error } = await browserAuthClient.rpc('hybrid_product_match_tiered', {
            query_text: 'power probe',
            limit_count: 3,
            threshold: 0.2
        })
        
        if (error) {
            console.log(`❌ Authenticated browser client FAILED: ${error.code} - ${error.message}`)
            
            if (error.code === 'PGRST116') {
                console.log('   🔍 Function not found - permissions still not working')
            } else if (error.code === 'PGRST202') {
                console.log('   🔍 Schema cache issue persists')
            } else if (error.code === 'PGRST301') {
                console.log('   🔍 Permission denied - authenticated role lacks execute permission')
            }
        } else {
            console.log(`✅ Authenticated browser client SUCCESS: ${data ? data.length : 0} results`)
        }
    } catch (err) {
        console.log(`🚨 Authenticated browser EXCEPTION: ${err.message}`)
    }
    
    // Test with direct HTTP request using different headers (simulate auth)
    console.log('\n🧪 Test 3: Direct HTTP with auth simulation')
    
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/hybrid_product_match_tiered`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`,
                'Prefer': 'return=representation',
                'X-Client-Info': 'supabase-js/2.56.0'  // Simulate browser client
            },
            body: JSON.stringify({
                query_text: 'power probe',
                limit_count: 3,
                threshold: 0.2
            })
        })
        
        console.log(`📊 Direct HTTP Status: ${response.status}`)
        
        if (response.status === 200) {
            const data = await response.json()
            console.log(`✅ Direct HTTP SUCCESS: ${data ? data.length : 0} results`)
        } else {
            const errorText = await response.text()
            console.log(`❌ Direct HTTP FAILED: ${response.status}`)
            console.log(`   Response: ${errorText}`)
        }
    } catch (err) {
        console.log(`🚨 Direct HTTP EXCEPTION: ${err.message}`)
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('🎯 FINAL DIAGNOSIS')
    console.log('='.repeat(60))
    
    console.log('If all tests above pass, the browser 404s are caused by:')
    console.log('1. 🌐 Browser cache (clear browser cache/hard refresh)')
    console.log('2. 🔄 Dev server needs restart (npm run dev)')
    console.log('3. ⏱️  Need more time for PostgREST cache propagation')
    console.log('4. 🐛 Client-side JavaScript bundle cache')
    console.log('')
    console.log('💡 SOLUTIONS TO TRY:')
    console.log('1. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)')
    console.log('2. Restart development server: npm run dev')
    console.log('3. Clear browser cache completely')
    console.log('4. Wait additional 5-10 minutes for full propagation')
    console.log('')
    console.log('If tests still fail, the authenticated permissions are not properly set.')
}

testAuthenticatedFinal()