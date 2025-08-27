#!/usr/bin/env node

// 🔧 Test the TypeScript signature fix
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function testTypescriptFix() {
    console.log('🔧 Testing TypeScript signature fix...')
    
    // Create client exactly like frontend does
    const frontendClient = createClient(supabaseUrl, anonKey)
    
    console.log('⏳ Waiting 30 seconds after deployment for cache refresh...')
    await new Promise(resolve => setTimeout(resolve, 30000))
    
    try {
        console.log('🧪 Testing frontend-style RPC call...')
        
        const { data, error } = await frontendClient.rpc('hybrid_product_match_tiered', {
            query_text: 'power probe',
            limit_count: 3,
            threshold: 0.1
        })
        
        if (error) {
            console.log('❌ STILL FAILING:')
            console.log(`   Code: ${error.code}`)
            console.log(`   Message: ${error.message}`)
            
            if (error.code === 'PGRST116') {
                console.log('   🔍 Function not found - may need more time for cache refresh')
            } else if (error.code === 'PGRST203') {
                console.log('   🔍 Still function overloading - cleanup may not have worked')
            }
            
            return false
        }
        
        console.log(`✅ SUCCESS! Found ${data ? data.length : 0} matches`)
        
        if (data && data.length > 0) {
            const first = data[0]
            console.log('📊 Sample result:')
            console.log(`   SKU: ${first.sku}`)
            console.log(`   Name: ${first.name}`)
            console.log(`   Score: ${first.final_score}`)
            console.log(`   Via: ${first.matched_via}`)
            console.log(`   Is Training: ${first.is_training_match}`)
            
            // Check if all expected fields are present
            const expectedFields = ['product_id', 'sku', 'name', 'manufacturer', 'category', 'vector_score', 'trigram_score', 'fuzzy_score', 'alias_score', 'final_score', 'matched_via', 'reasoning', 'is_training_match']
            const missingFields = expectedFields.filter(field => !(field in first))
            
            if (missingFields.length === 0) {
                console.log('✅ All expected TypeScript fields are present')
                return true
            } else {
                console.log(`❌ Missing fields: ${missingFields.join(', ')}`)
                return false
            }
        }
        
        return true
        
    } catch (err) {
        console.log('🚨 Exception during test:', err.message)
        return false
    }
}

async function main() {
    console.log('🎯 ROOT CAUSE IDENTIFIED: TypeScript signature mismatch')
    console.log('   Frontend expects: is_training_match field')
    console.log('   Function returns: missing is_training_match')
    console.log('')
    console.log('📋 SOLUTION: Run FIX_TYPESCRIPT_MISMATCH.sql in Supabase SQL Editor')
    console.log('   This adds the missing is_training_match field to the function')
    console.log('')
    
    const success = await testTypescriptFix()
    
    if (success) {
        console.log('\n🎉 TYPESCRIPT MISMATCH RESOLVED!')
        console.log('✅ Function signature now matches frontend expectations')
        console.log('✅ Frontend 404 errors should be fixed')
        console.log('✅ Matches page should load successfully')
    } else {
        console.log('\n⚠️ Function still not working as expected')
        console.log('📋 Next steps:')
        console.log('1. Ensure FIX_TYPESCRIPT_MISMATCH.sql was run successfully')
        console.log('2. Wait additional time for PostgREST cache refresh')
        console.log('3. Check Supabase logs for any deployment errors')
    }
}

main()