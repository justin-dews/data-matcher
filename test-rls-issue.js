#!/usr/bin/env node

// 🔍 Test if RLS is blocking the matches page data
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function testRLSIssue() {
    console.log('🔍 Testing if RLS is blocking matches page data...')
    
    const organizationId = '00000000-0000-0000-0000-000000000001'
    
    // Test 1: Anonymous client (what browser currently uses)
    console.log('\n🧪 Test 1: Anonymous client (current browser behavior)...')
    const anonClient = createClient(supabaseUrl, anonKey)
    
    const { data: anonData, error: anonError } = await anonClient
        .from('line_items')
        .select('id, raw_text, organization_id')
        .eq('organization_id', organizationId)
        .limit(3)
    
    if (anonError) {
        console.log(`❌ Anonymous client failed: ${anonError.message}`)
    } else {
        console.log(`✅ Anonymous client: ${anonData?.length || 0} line items (RLS allowed)`)
    }
    
    // Test 2: Service role client (bypasses RLS)
    console.log('\n🧪 Test 2: Service role client (bypasses RLS)...')
    const serviceClient = createClient(supabaseUrl, serviceKey)
    
    const { data: serviceData, error: serviceError } = await serviceClient
        .from('line_items')
        .select('id, raw_text, organization_id')
        .eq('organization_id', organizationId)
        .limit(3)
    
    if (serviceError) {
        console.log(`❌ Service client failed: ${serviceError.message}`)
    } else {
        console.log(`✅ Service client: ${serviceData?.length || 0} line items (bypasses RLS)`)
    }
    
    // Test 3: Check if user profile exists
    console.log('\n🧪 Test 3: Checking user profiles...')
    const { data: profiles, error: profileError } = await serviceClient
        .from('profiles')
        .select('*')
        .limit(5)
    
    if (profileError) {
        console.log(`❌ Profile check failed: ${profileError.message}`)
    } else {
        console.log(`✅ Found ${profiles?.length || 0} profiles`)
        
        if (profiles && profiles.length > 0) {
            profiles.forEach((profile, i) => {
                console.log(`\n👤 Profile ${i+1}:`)
                console.log(`   ID: ${profile.id}`)
                console.log(`   Email: ${profile.email}`)
                console.log(`   Org ID: ${profile.organization_id}`)
            })
        }
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('🎯 RLS DIAGNOSIS')
    console.log('='.repeat(60))
    
    if (anonData?.length === 0 && serviceData?.length > 0) {
        console.log('❌ ISSUE IDENTIFIED: RLS policies are blocking anonymous access')
        console.log('💡 SOLUTION: User needs to be authenticated to see their data')
        console.log('🔧 The matches page needs proper authentication')
    } else if (anonData?.length > 0) {
        console.log('✅ RLS is working correctly - anonymous users can see data')
        console.log('🤔 Issue must be elsewhere in the query logic')
    } else {
        console.log('❓ Both queries failed - investigate further')
    }
}

testRLSIssue()