#!/usr/bin/env node

// 🔍 Debug authenticated query to see why line items aren't showing
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function debugAuthenticatedQuery() {
    console.log('🔍 Debugging authenticated matches page query...')
    
    const client = createClient(supabaseUrl, anonKey)
    
    // Simulate authenticated user - the real user who uploaded
    const userId = 'b903b88d-e667-4dde-94ff-79dbbb1fcb38'
    const organizationId = '00000000-0000-0000-0000-000000000001'
    
    console.log(`\n👤 Testing as user: ${userId}`)
    console.log(`🏢 Organization: ${organizationId}`)
    
    // Test 1: Basic line items query as authenticated user would see
    console.log('\n🧪 Test 1: Line items with matches (exact matches page query)...')
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
            .limit(10)
        
        if (error) {
            console.log(`❌ Query failed: ${error.code} - ${error.message}`)
            console.log(`Details: ${error.details}`)
        } else {
            console.log(`✅ Query success: ${data ? data.length : 0} line items found`)
            
            if (data && data.length > 0) {
                console.log('\n📋 Detailed Results:')
                data.slice(0, 3).forEach((item, i) => {
                    console.log(`\n🔍 Line Item ${i+1}:`)
                    console.log(`   ID: ${item.id}`)
                    console.log(`   Raw Text: "${item.raw_text}"`)
                    console.log(`   Parsed Data: ${JSON.stringify(item.parsed_data?.name || 'None')}`)
                    console.log(`   Org ID: ${item.organization_id}`)
                    console.log(`   Document ID: ${item.document_id}`)
                    console.log(`   Matches Count: ${item.matches?.length || 0}`)
                    
                    if (item.matches && item.matches.length > 0) {
                        item.matches.forEach((match, mi) => {
                            console.log(`   🎯 Match ${mi+1}:`)
                            console.log(`      ID: ${match.id}`)
                            console.log(`      Status: ${match.status}`)
                            console.log(`      Score: ${match.final_score}`)
                            console.log(`      Product: ${match.products?.name || 'No product linked'}`)
                            console.log(`      SKU: ${match.products?.sku || 'No SKU'}`)
                        })
                    } else {
                        console.log(`   ❌ NO MATCHES linked to this line item`)
                    }
                })
                
                // Check for orphaned matches
                console.log(`\n🔍 Checking for data consistency issues...`)
                const itemsWithoutMatches = data.filter(item => !item.matches || item.matches.length === 0)
                const itemsWithMatches = data.filter(item => item.matches && item.matches.length > 0)
                
                console.log(`   📊 Items with matches: ${itemsWithMatches.length}`)
                console.log(`   📊 Items without matches: ${itemsWithoutMatches.length}`)
                
                if (itemsWithoutMatches.length > 0) {
                    console.log(`   ⚠️  Some line items have no linked matches - checking for orphaned matches...`)
                }
            }
        }
    } catch (err) {
        console.log(`🚨 Exception: ${err.message}`)
    }
    
    // Test 2: Check matches table directly
    console.log('\n🧪 Test 2: Direct matches table query...')
    try {
        const { data: matches, error: matchError } = await client
            .from('matches')
            .select(`
                id,
                line_item_id,
                product_id,
                status,
                final_score,
                matched_text,
                organization_id,
                products (
                    id,
                    sku,
                    name,
                    manufacturer
                )
            `)
            .eq('organization_id', organizationId)
            .limit(5)
        
        if (matchError) {
            console.log(`❌ Matches query failed: ${matchError.message}`)
        } else {
            console.log(`✅ Found ${matches?.length || 0} matches in matches table`)
            
            if (matches && matches.length > 0) {
                matches.forEach((match, i) => {
                    console.log(`\n🎯 Direct Match ${i+1}:`)
                    console.log(`   Match ID: ${match.id}`)
                    console.log(`   Line Item ID: ${match.line_item_id}`)
                    console.log(`   Product: ${match.products?.name}`)
                    console.log(`   SKU: ${match.products?.sku}`)
                    console.log(`   Status: ${match.status}`)
                    console.log(`   Score: ${match.final_score}`)
                })
            }
        }
    } catch (err) {
        console.log(`🚨 Matches query exception: ${err.message}`)
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('🎯 LINE ITEMS MISSING DIAGNOSIS')
    console.log('='.repeat(60))
}

debugAuthenticatedQuery()