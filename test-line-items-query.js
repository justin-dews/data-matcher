#!/usr/bin/env node

// 🔍 Test the line items query to debug the matches page issue
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function testLineItemsQuery() {
    console.log('🔍 Testing line items query to debug matches page...')
    
    const client = createClient(supabaseUrl, anonKey)
    
    // Test 1: Check if optimized function exists
    console.log('\n🧪 Test 1: Checking optimized RPC function...')
    try {
        const { data, error } = await client.rpc('get_line_items_with_matches_optimized', {
            p_organization_id: 'test-org-id',
            p_limit: 5,
            p_offset: 0
        })
        
        if (error) {
            console.log(`❌ Optimized function failed: ${error.code} - ${error.message}`)
            if (error.hint) console.log(`💡 Hint: ${error.hint}`)
        } else {
            console.log(`✅ Optimized function works: ${data ? data.length : 0} results`)
        }
    } catch (err) {
        console.log(`🚨 Exception calling optimized function: ${err.message}`)
    }
    
    // Test 2: Test the fallback standard query
    console.log('\n🧪 Test 2: Testing fallback standard query...')
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
            .order('created_at', { ascending: false })
            .limit(10)
        
        if (error) {
            console.log(`❌ Standard query failed: ${error.code} - ${error.message}`)
        } else {
            console.log(`✅ Standard query works: ${data ? data.length : 0} line items found`)
            
            if (data && data.length > 0) {
                console.log('\n📋 Sample Results:')
                data.slice(0, 3).forEach((item, i) => {
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
        console.log(`🚨 Exception in standard query: ${err.message}`)
    }
    
    // Test 3: Simple line items count
    console.log('\n🧪 Test 3: Checking basic line items count...')
    try {
        const { data, error } = await client
            .from('line_items')
            .select('id')
        
        if (error) {
            console.log(`❌ Line items count failed: ${error.message}`)
        } else {
            console.log(`✅ Total line items in database: ${data ? data.length : 0}`)
        }
    } catch (err) {
        console.log(`🚨 Exception counting line items: ${err.message}`)
    }
    
    // Test 4: Simple matches count
    console.log('\n🧪 Test 4: Checking matches count...')
    try {
        const { data, error } = await client
            .from('matches')
            .select('id')
        
        if (error) {
            console.log(`❌ Matches count failed: ${error.message}`)
        } else {
            console.log(`✅ Total matches in database: ${data ? data.length : 0}`)
        }
    } catch (err) {
        console.log(`🚨 Exception counting matches: ${err.message}`)
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('🎯 DIAGNOSIS COMPLETE')
    console.log('='.repeat(60))
}

testLineItemsQuery()