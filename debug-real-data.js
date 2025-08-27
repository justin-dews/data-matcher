#!/usr/bin/env node

// 🔍 Debug with actual user data to see what happened
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function debugRealData() {
    console.log('🔍 Checking actual data with service role key...')
    
    // Use service role key to bypass RLS and see all data
    const supabase = createClient(supabaseUrl, serviceKey)
    
    // Check documents table first
    console.log('\n🧪 Checking documents table...')
    const { data: documents, error: docError } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
    
    if (docError) {
        console.log(`❌ Documents query failed: ${docError.message}`)
    } else {
        console.log(`✅ Found ${documents?.length || 0} documents`)
        
        if (documents && documents.length > 0) {
            documents.forEach((doc, i) => {
                console.log(`\n📄 Document ${i+1}:`)
                console.log(`   ID: ${doc.id}`)
                console.log(`   Filename: ${doc.filename}`)
                console.log(`   Status: ${doc.status}`)
                console.log(`   Org ID: ${doc.organization_id}`)
                console.log(`   User ID: ${doc.user_id}`)
                console.log(`   Created: ${doc.created_at}`)
            })
        }
    }
    
    // Check line items
    console.log('\n🧪 Checking line_items table...')
    const { data: lineItems, error: lineError } = await supabase
        .from('line_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
    
    if (lineError) {
        console.log(`❌ Line items query failed: ${lineError.message}`)
    } else {
        console.log(`✅ Found ${lineItems?.length || 0} line items`)
        
        if (lineItems && lineItems.length > 0) {
            lineItems.forEach((item, i) => {
                console.log(`\n📋 Line Item ${i+1}:`)
                console.log(`   ID: ${item.id}`)
                console.log(`   Text: ${item.raw_text?.substring(0, 100)}...`)
                console.log(`   Document ID: ${item.document_id}`)
                console.log(`   Org ID: ${item.organization_id}`)
                console.log(`   Created: ${item.created_at}`)
            })
        }
    }
    
    // Check matches
    console.log('\n🧪 Checking matches table...')
    const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)
    
    if (matchError) {
        console.log(`❌ Matches query failed: ${matchError.message}`)
    } else {
        console.log(`✅ Found ${matches?.length || 0} matches`)
        
        if (matches && matches.length > 0) {
            matches.forEach((match, i) => {
                console.log(`\n🎯 Match ${i+1}:`)
                console.log(`   ID: ${match.id}`)
                console.log(`   Line Item ID: ${match.line_item_id}`)
                console.log(`   Product ID: ${match.product_id}`)
                console.log(`   Status: ${match.status}`)
                console.log(`   Score: ${match.final_score}`)
                console.log(`   Org ID: ${match.organization_id}`)
                console.log(`   Created: ${match.created_at}`)
            })
        }
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('🎯 DATA INVESTIGATION COMPLETE')
    console.log('='.repeat(60))
}

debugRealData()