#!/usr/bin/env node

// 🧪 Test the newly deployed batch function
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function testBatchFunction() {
    console.log('🧪 Testing deployed batch function...')
    
    const client = createClient(supabaseUrl, anonKey)
    
    // Test with sample queries
    const testQueries = ['power probe', 'multimeter', 'test equipment']
    
    console.log(`\n📋 Testing batch function with ${testQueries.length} queries:`)
    console.log(testQueries.map((q, i) => `   ${i+1}. "${q}"`).join('\n'))
    
    try {
        const { data, error } = await client.rpc('hybrid_product_match_batch', {
            query_texts: testQueries,
            limit_count: 2,
            threshold: 0.2
        })
        
        if (error) {
            console.log(`\n❌ BATCH FUNCTION ERROR: ${error.code} - ${error.message}`)
            if (error.details) {
                console.log(`📄 Details: ${error.details}`)
            }
            if (error.hint) {
                console.log(`💡 Hint: ${error.hint}`)
            }
        } else {
            console.log(`\n✅ BATCH FUNCTION SUCCESS!`)
            console.log(`📊 Total results: ${data ? data.length : 0}`)
            
            if (data && data.length > 0) {
                console.log(`\n📋 Sample Results:`)
                const grouped = {}
                data.forEach(item => {
                    if (!grouped[item.query_index]) grouped[item.query_index] = []
                    grouped[item.query_index].push(item)
                })
                
                Object.keys(grouped).forEach(queryIndex => {
                    const results = grouped[queryIndex]
                    const query = results[0]?.query_text || 'Unknown'
                    console.log(`\n🔍 Query ${queryIndex}: "${query}"`)
                    results.forEach(r => {
                        console.log(`   ✅ ${r.name} (${r.sku}) - Score: ${r.final_score} via ${r.matched_via}`)
                    })
                })
            }
        }
    } catch (err) {
        console.log(`\n🚨 BATCH FUNCTION EXCEPTION: ${err.message}`)
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('🎯 BATCH FUNCTION TEST COMPLETE')
    console.log('='.repeat(60))
    
    if (error) {
        console.log('❌ The batch optimization will fall back to individual function calls')
        console.log('✅ Individual calls should still work with parameter validation fix')
    } else {
        console.log('✅ Batch function is working - performance should be improved')
        console.log('✅ Frontend should now work without PGRST202 errors')
    }
}

testBatchFunction()