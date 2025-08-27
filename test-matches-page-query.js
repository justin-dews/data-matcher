#!/usr/bin/env node

// 🔍 Test the exact query used by the matches page
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function testMatchesPageQuery() {
    console.log('🔍 Testing exact matches page query...')
    
    const client = createClient(supabaseUrl, anonKey)
    
    // The real organization ID from the data
    const organizationId = '00000000-0000-0000-0000-000000000001'
    
    console.log(`\n🧪 Testing with organization ID: ${organizationId}`)
    
    // Test 1: Try the optimized RPC function with real org ID
    console.log('\n🧪 Test 1: Optimized RPC function with real org ID...')
    try {
        const { data, error } = await client.rpc('get_line_items_with_matches_optimized', {
            p_organization_id: organizationId,
            p_limit: 100,
            p_offset: 0
        })
        
        if (error) {
            console.log(`❌ Optimized function failed: ${error.code} - ${error.message}`)
            if (error.details) console.log(`📄 Details: ${error.details}`)
        } else {
            console.log(`✅ Optimized function success: ${data ? data.length : 0} results`)
            
            if (data && data.length > 0) {
                console.log('\n📋 Sample optimized results:')
                data.slice(0, 2).forEach((row, i) => {
                    console.log(`\n🔍 Result ${i+1}:`)
                    console.log(`   Line Item ID: ${row.line_item_id}`)
                    console.log(`   Text: ${row.line_item_raw_text?.substring(0, 50)}...`)
                    console.log(`   Match ID: ${row.match_id}`)
                    console.log(`   Product Name: ${row.product_name}`)
                    console.log(`   Status: ${row.match_status}`)
                    console.log(`   Score: ${row.match_final_score}`)
                })
            }
        }
    } catch (err) {
        console.log(`🚨 Exception: ${err.message}`)
    }
    
    // Test 2: Fallback standard query with real org ID
    console.log('\n🧪 Test 2: Standard fallback query with real org ID...')
    try {
        const { data, error } = await client
            .from('line_items')
            .select(`
                id,
                raw_text,
                parsed_data,
                company_name,
                created_at,
                document_id,
                line_number,
                quantity,
                unit_price,
                total_price,
                organization_id,
                matches!left (
                    id,
                    product_id,
                    status,
                    confidence_score,
                    final_score,
                    matched_text,
                    reasoning,
                    created_at,
                    updated_at,
                    products (
                        id,
                        sku,
                        name,
                        manufacturer,
                        category
                    )
                )
            `)
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(100)
        
        if (error) {
            console.log(`❌ Standard query failed: ${error.code} - ${error.message}`)
        } else {
            console.log(`✅ Standard query success: ${data ? data.length : 0} line items`)
            
            if (data && data.length > 0) {
                console.log('\n📋 Sample standard results:')
                data.slice(0, 2).forEach((item, i) => {
                    console.log(`\n🔍 Line Item ${i+1}:`)
                    console.log(`   ID: ${item.id}`)
                    console.log(`   Text: ${item.raw_text?.substring(0, 50)}...`)
                    console.log(`   Matches: ${item.matches?.length || 0}`)
                    
                    if (item.matches && item.matches.length > 0) {
                        const match = item.matches[0]
                        console.log(`   Match Status: ${match.status}`)
                        console.log(`   Match Score: ${match.final_score}`)
                        console.log(`   Product: ${match.products?.name || 'No product info'}`)
                    }
                })
            }
        }
    } catch (err) {
        console.log(`🚨 Exception: ${err.message}`)
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('🎯 MATCHES PAGE QUERY TEST COMPLETE')
    console.log('='.repeat(60))
}

testMatchesPageQuery()