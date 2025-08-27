#!/usr/bin/env node

// 🗑️ Clear all matches and line items for fresh start
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function clearMatchesData() {
    console.log('🗑️ Clearing all matches and line items for fresh start...')
    
    // Use service role key for admin operations
    const supabase = createClient(supabaseUrl, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    
    try {
        console.log('\n🧹 Step 1: Clearing all matches...')
        const { error: matchesError } = await supabase
            .from('matches')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all except impossible UUID
            
        if (matchesError) {
            console.log(`❌ Error clearing matches: ${matchesError.message}`)
            return
        }
        console.log('✅ All matches cleared')
        
        console.log('\n🧹 Step 2: Clearing all line items...')
        const { error: lineItemsError } = await supabase
            .from('line_items')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all except impossible UUID
            
        if (lineItemsError) {
            console.log(`❌ Error clearing line items: ${lineItemsError.message}`)
            return
        }
        console.log('✅ All line items cleared')
        
        console.log('\n🧹 Step 3: Clearing all documents...')
        const { error: documentsError } = await supabase
            .from('documents')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all except impossible UUID
            
        if (documentsError) {
            console.log(`❌ Error clearing documents: ${documentsError.message}`)
            return
        }
        console.log('✅ All documents cleared')
        
        console.log('\n📊 Verification: Checking remaining data...')
        
        const { data: remainingMatches } = await supabase
            .from('matches')
            .select('id')
            
        const { data: remainingLineItems } = await supabase
            .from('line_items')
            .select('id')
            
        const { data: remainingDocuments } = await supabase
            .from('documents')
            .select('id')
        
        console.log(`📊 Remaining data:`)
        console.log(`   - Matches: ${remainingMatches?.length || 0}`)
        console.log(`   - Line Items: ${remainingLineItems?.length || 0}`)
        console.log(`   - Documents: ${remainingDocuments?.length || 0}`)
        
    } catch (error) {
        console.log(`🚨 Unexpected error: ${error.message}`)
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('🎉 DATABASE CLEARED SUCCESSFULLY')
    console.log('='.repeat(60))
    console.log('✅ All matches, line items, and documents removed')
    console.log('✅ Ready for fresh document upload')
    console.log('')
    console.log('💡 Next steps:')
    console.log('   1. Go to http://localhost:3000/dashboard/upload')
    console.log('   2. Upload a new PDF document')
    console.log('   3. Watch automatic parsing and matching in action')
    console.log('   4. Review results in /dashboard/matches')
}

clearMatchesData()
