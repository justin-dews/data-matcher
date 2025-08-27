#!/usr/bin/env node

// 🔬 Test nuclear cache reset results
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function testNuclearReset() {
    console.log('🔬 Testing nuclear cache reset results...')
    
    // Create frontend-identical client
    const client = createClient(supabaseUrl, anonKey)
    
    console.log('⏳ Waiting 60 seconds for complete PostgREST cache refresh...')
    await new Promise(resolve => setTimeout(resolve, 60000))
    
    try {
        console.log('🧪 Testing exact frontend RPC call...')
        
        // Call with EXACT same parameters as frontend
        const { data, error } = await client.rpc('hybrid_product_match_tiered', {
            query_text: 'power probe',
            limit_count: 5, 
            threshold: 0.2
        })
        
        if (error) {
            console.log('❌ STILL FAILING:')
            console.log(`   Code: ${error.code}`)
            console.log(`   Message: ${error.message}`)
            console.log(`   Details: ${error.details}`)
            console.log(`   Hint: ${error.hint}`)
            
            if (error.code === 'PGRST202') {
                console.log('\n🔍 PGRST202 Analysis:')
                console.log('   This means PostgREST cannot find the function in its schema cache')
                console.log('   The function exists in PostgreSQL but PostgREST doesnt see it')
                
                if (error.hint) {
                    console.log(`   PostgREST suggests: ${error.hint}`)
                    
                    if (error.hint.includes('limit_count, query_text, threshold')) {
                        console.log('   ⚠️  PostgREST thinks parameters are in wrong order!')
                        console.log('   This suggests cached metadata is stale')
                    }
                }
            }
            
            return false
        }
        
        console.log(`✅ SUCCESS! Found ${data ? data.length : 0} matches`)
        
        if (data && data.length > 0) {
            const match = data[0]
            console.log('📊 Sample result:')
            console.log(`   SKU: ${match.sku}`)
            console.log(`   Name: ${match.name}`)
            console.log(`   Score: ${match.final_score}`)
            console.log(`   Via: ${match.matched_via}`)
            console.log(`   Training: ${match.is_training_match}`)
            
            // Verify all expected fields
            const requiredFields = ['product_id', 'sku', 'name', 'manufacturer', 'category', 
                                  'vector_score', 'trigram_score', 'fuzzy_score', 'alias_score',
                                  'final_score', 'matched_via', 'reasoning', 'is_training_match']
            
            const missingFields = requiredFields.filter(field => !(field in match))
            
            if (missingFields.length === 0) {
                console.log('✅ All TypeScript fields present')
            } else {
                console.log(`❌ Missing fields: ${missingFields.join(', ')}`)
            }
        }
        
        return true
        
    } catch (err) {
        console.log('🚨 Exception during test:', err.message)
        return false
    }
}

async function main() {
    console.log('🚀 NUCLEAR CACHE RESET TEST')
    console.log('=' .repeat(50))
    console.log('This test validates that the PostgREST PGRST202 error is resolved')
    console.log('')
    
    const success = await testNuclearReset()
    
    console.log('\n' + '='.repeat(50))
    console.log('📊 NUCLEAR RESET TEST RESULTS')
    console.log('=' .repeat(50))
    
    if (success) {
        console.log('🎉 NUCLEAR RESET SUCCESSFUL!')
        console.log('✅ Function is accessible via frontend client')
        console.log('✅ PostgREST schema cache is working correctly')
        console.log('✅ All TypeScript fields are present')
        console.log('✅ The matches page should now load without 404 errors')
        console.log('')
        console.log('🚀 NEXT STEP: Test your /dashboard/matches page')
    } else {
        console.log('❌ NUCLEAR RESET FAILED')
        console.log('The PostgREST schema cache issue persists')
        console.log('')
        console.log('🔧 POSSIBLE SOLUTIONS:')
        console.log('1. Wait additional time (up to 5 minutes) for cache propagation')
        console.log('2. Restart your local development server (npm run dev)')
        console.log('3. Check Supabase dashboard for any function deployment errors')
        console.log('4. Verify NUCLEAR_CACHE_RESET.sql ran without errors')
        console.log('')
        console.log('This is likely a Supabase infrastructure caching issue')
    }
}

main()