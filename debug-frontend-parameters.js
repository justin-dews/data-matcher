#!/usr/bin/env node

// 🔍 Debug what parameters the frontend is actually sending
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function debugFrontendParameters() {
    console.log('🔍 Testing different parameter scenarios that could cause PGRST202...')
    
    const client = createClient(supabaseUrl, anonKey)
    
    // Test cases that might match what the frontend is doing wrong
    const testCases = [
        {
            name: 'Valid call (should work)',
            params: {
                query_text: 'power probe',
                limit_count: 5,
                threshold: 0.2
            }
        },
        {
            name: 'Empty query_text',
            params: {
                query_text: '',
                limit_count: 5,
                threshold: 0.2
            }
        },
        {
            name: 'Null query_text',
            params: {
                query_text: null,
                limit_count: 5,
                threshold: 0.2
            }
        },
        {
            name: 'Undefined query_text',
            params: {
                query_text: undefined,
                limit_count: 5,
                threshold: 0.2
            }
        },
        {
            name: 'Missing query_text parameter',
            params: {
                limit_count: 5,
                threshold: 0.2
            }
        },
        {
            name: 'Wrong parameter order',
            params: {
                limit_count: 5,
                query_text: 'power probe',
                threshold: 0.2
            }
        }
    ]
    
    for (const testCase of testCases) {
        console.log(`\n🧪 Testing: ${testCase.name}`)
        console.log(`📋 Parameters:`, JSON.stringify(testCase.params, null, 2))
        
        try {
            const { data, error } = await client.rpc('hybrid_product_match_tiered', testCase.params)
            
            if (error) {
                console.log(`❌ FAILED: ${error.code} - ${error.message}`)
                if (error.hint) {
                    console.log(`💡 Hint: ${error.hint}`)
                }
                if (error.details) {
                    console.log(`📄 Details: ${error.details}`)
                }
                
                // Check if this matches the browser error
                if (error.code === 'PGRST202' && error.message.includes('limit_count, threshold')) {
                    console.log('🎯 THIS MATCHES THE BROWSER ERROR!')
                }
            } else {
                console.log(`✅ SUCCESS: ${data ? data.length : 0} results`)
            }
        } catch (err) {
            console.log(`🚨 EXCEPTION: ${err.message}`)
        }
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('🎯 ANALYSIS')
    console.log('='.repeat(60))
    console.log('If any test case above matches the browser error,')
    console.log('that reveals what the frontend is doing wrong.')
    console.log('')
    console.log('Common causes:')
    console.log('1. query_text is undefined/null/empty')
    console.log('2. Parameters are in wrong order')
    console.log('3. query_text parameter is missing entirely')
    console.log('4. Function signature mismatch in browser vs Node.js')
}

debugFrontendParameters()