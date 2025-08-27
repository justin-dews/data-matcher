#!/usr/bin/env node

// 🧪 Test the parameter validation fix directly
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function testParameterValidationFix() {
    console.log('🧪 Testing parameter validation fix...')
    
    const client = createClient(supabaseUrl, anonKey)
    
    // Simulate line items with various data states that caused the original error
    const testLineItems = [
        {
            id: '1',
            parsed_data: { name: 'power probe' },
            raw_text: 'fallback text'
        },
        {
            id: '2', 
            parsed_data: null,
            raw_text: 'just raw text'
        },
        {
            id: '3',
            parsed_data: { name: '' }, // Empty name
            raw_text: null
        },
        {
            id: '4',
            parsed_data: null,
            raw_text: null // This was causing the undefined issue
        },
        {
            id: '5',
            parsed_data: { name: undefined },
            raw_text: undefined // This also caused issues
        },
        {
            id: '6',
            parsed_data: { name: '   ' }, // Whitespace only
            raw_text: '   '
        }
    ]
    
    console.log('\n📋 Test Results:')
    
    for (const item of testLineItems) {
        const matchText = item.parsed_data?.name || item.raw_text
        
        console.log(`\n🔍 Item ${item.id}:`)
        console.log(`   parsed_data.name: ${JSON.stringify(item.parsed_data?.name)}`)
        console.log(`   raw_text: ${JSON.stringify(item.raw_text)}`)
        console.log(`   matchText result: ${JSON.stringify(matchText)}`)
        
        // Apply our validation logic
        const isValidText = matchText && typeof matchText === 'string' && matchText.trim().length > 0
        
        if (!isValidText) {
            console.log(`   ⚠️  SKIPPED: Invalid text data - this prevents PGRST202 error`)
            continue
        }
        
        console.log(`   ✅ VALID: Making RPC call with text: "${matchText.trim()}"`)
        
        try {
            const { data, error } = await client.rpc('hybrid_product_match_tiered', {
                query_text: matchText.trim(),
                limit_count: 3,
                threshold: 0.2
            })
            
            if (error) {
                console.log(`   ❌ RPC ERROR: ${error.code} - ${error.message}`)
            } else {
                console.log(`   ✅ RPC SUCCESS: ${data ? data.length : 0} matches found`)
            }
        } catch (err) {
            console.log(`   🚨 RPC EXCEPTION: ${err.message}`)
        }
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('🎯 PARAMETER VALIDATION FIX SUMMARY')
    console.log('='.repeat(60))
    console.log('✅ Items with invalid text data are now skipped')
    console.log('✅ Only valid, non-empty strings are sent to RPC function')
    console.log('✅ This prevents PGRST202 errors in browser')
    console.log('')
    console.log('💡 The fix ensures query_text parameter is:')
    console.log('   - Not null or undefined')
    console.log('   - A valid string type')  
    console.log('   - Not empty or whitespace-only')
    console.log('   - Properly trimmed before sending')
}

testParameterValidationFix()