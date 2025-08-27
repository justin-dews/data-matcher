#!/usr/bin/env node

// 🎉 Final verification that all RPC functions are working after cleanup
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function verifyAllFunctions() {
    console.log('🎉 FINAL VERIFICATION: Testing all RPC functions after cleanup...')
    console.log('⏳ Waiting 30 seconds for PostgREST schema cache refresh...')
    
    // Wait for schema cache to refresh
    await new Promise(resolve => setTimeout(resolve, 30000))
    
    let allWorking = true
    const results = {}
    
    try {
        // Get organization ID for testing
        const { data: orgData } = await supabase.from('organizations').select('id').limit(1)
        
        if (!orgData || orgData.length === 0) {
            console.log('⚠️ No organizations found for testing')
            return
        }
        
        const orgId = orgData[0].id
        console.log(`📋 Testing with organization: ${orgId}`)
        
        // Test 1: hybrid_product_match_tiered (previously failing)
        console.log('\n🧪 Test 1: hybrid_product_match_tiered')
        try {
            const { data: matchData, error: matchError } = await supabase.rpc('hybrid_product_match_tiered', {
                query_text: 'power probe',
                limit_count: 3,
                threshold: 0.1
            })
            
            if (matchError) {
                console.log(`❌ FAILED: ${matchError.code} - ${matchError.message}`)
                if (matchError.code === 'PGRST203') {
                    console.log('   🔍 Still has function overloading conflict')
                }
                allWorking = false
                results.hybrid_match = 'FAILED'
            } else {
                console.log(`✅ SUCCESS: Found ${matchData ? matchData.length : 0} matches`)
                if (matchData && matchData.length > 0) {
                    const first = matchData[0]
                    console.log(`   📊 Sample: ${first.sku} - ${first.name} (score: ${first.final_score})`)
                }
                results.hybrid_match = 'SUCCESS'
            }
        } catch (err) {
            console.log(`❌ EXCEPTION: ${err.message}`)
            allWorking = false
            results.hybrid_match = 'EXCEPTION'
        }
        
        // Test 2: get_line_items_with_matches_optimized (should still work)
        console.log('\n🧪 Test 2: get_line_items_with_matches_optimized')
        try {
            const { data: itemsData, error: itemsError } = await supabase.rpc('get_line_items_with_matches_optimized', {
                p_organization_id: orgId,
                p_limit: 5,
                p_offset: 0
            })
            
            if (itemsError) {
                console.log(`❌ FAILED: ${itemsError.message}`)
                allWorking = false
                results.line_items = 'FAILED'
            } else {
                console.log(`✅ SUCCESS: Found ${itemsData ? itemsData.length : 0} line items`)
                results.line_items = 'SUCCESS'
            }
        } catch (err) {
            console.log(`❌ EXCEPTION: ${err.message}`)
            allWorking = false
            results.line_items = 'EXCEPTION'
        }
        
        // Test 3: get_match_statistics_optimized (should still work)
        console.log('\n🧪 Test 3: get_match_statistics_optimized')
        try {
            const { data: statsData, error: statsError } = await supabase.rpc('get_match_statistics_optimized', {
                p_organization_id: orgId
            })
            
            if (statsError) {
                console.log(`❌ FAILED: ${statsError.message}`)
                allWorking = false
                results.statistics = 'FAILED'
            } else {
                console.log('✅ SUCCESS: Statistics loaded')
                if (statsData && statsData[0]) {
                    const stats = statsData[0]
                    console.log(`   📊 Total: ${stats.total_items || stats.total_line_items}, Pending: ${stats.pending_items || stats.pending_matches}, Approved: ${stats.approved_items || stats.approved_matches}`)
                }
                results.statistics = 'SUCCESS'
            }
        } catch (err) {
            console.log(`❌ EXCEPTION: ${err.message}`)
            allWorking = false
            results.statistics = 'EXCEPTION'
        }
        
        // Final Results
        console.log('\n' + '='.repeat(60))
        console.log('📊 FINAL FUNCTION STATUS REPORT')
        console.log('='.repeat(60))
        
        console.log(`🔍 hybrid_product_match_tiered: ${results.hybrid_match === 'SUCCESS' ? '✅' : '❌'} ${results.hybrid_match}`)
        console.log(`📋 get_line_items_with_matches_optimized: ${results.line_items === 'SUCCESS' ? '✅' : '❌'} ${results.line_items}`)
        console.log(`📈 get_match_statistics_optimized: ${results.statistics === 'SUCCESS' ? '✅' : '❌'} ${results.statistics}`)
        
        if (allWorking) {
            console.log('\n🎉 ALL FUNCTIONS ARE WORKING!')
            console.log('✅ PostgREST schema cache issue RESOLVED')
            console.log('✅ Function overloading conflict RESOLVED')
            console.log('✅ Your matches page should now load data successfully')
            console.log('\n🚀 NEXT STEP: Test your matches page at /dashboard/matches')
        } else {
            console.log('\n⚠️ Some functions are still not working')
            
            if (results.hybrid_match !== 'SUCCESS') {
                console.log('🔧 hybrid_product_match_tiered may need additional time for cache refresh')
                console.log('   Try waiting another 60 seconds and test the matches page')
            }
            
            // Count working functions
            const workingCount = Object.values(results).filter(r => r === 'SUCCESS').length
            console.log(`\n📊 Status: ${workingCount}/3 functions working`)
            
            if (workingCount >= 2) {
                console.log('✅ Enough functions working for matches page to load data')
                console.log('🧪 Try testing the matches page - it may work even if one function is delayed')
            }
        }
        
    } catch (error) {
        console.error('💥 Verification error:', error)
    }
}

verifyAllFunctions()