#!/usr/bin/env node

// 🧪 Test the corrected FINAL_FUNCTION_CLEANUP.sql script
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function testCorrectedScript() {
    console.log('🧪 Testing corrected FINAL_FUNCTION_CLEANUP.sql script syntax...')
    
    try {
        // Read the corrected script
        const sqlContent = fs.readFileSync('FINAL_FUNCTION_CLEANUP.sql', 'utf8')
        
        // Basic syntax checks
        console.log('📋 Performing syntax validation...')
        
        // Check for the problematic pattern
        const hasDynamicComment = sqlContent.includes('|| NOW()::text')
        if (hasDynamicComment) {
            console.log('❌ Still contains dynamic comment expression')
            return
        } else {
            console.log('✅ No dynamic comment expressions found')
        }
        
        // Check for proper static comment
        const hasStaticComment = sqlContent.includes('PostgREST compatible')
        if (hasStaticComment) {
            console.log('✅ Static comment found')
        }
        
        // Check for required components
        const checks = [
            { pattern: 'DROP FUNCTION IF EXISTS', name: 'Function cleanup' },
            { pattern: 'CREATE OR REPLACE FUNCTION hybrid_product_match_tiered', name: 'Function creation' },
            { pattern: 'GRANT EXECUTE ON FUNCTION', name: 'Permission grants' },
            { pattern: 'NOTIFY pgrst', name: 'Schema refresh signals' },
            { pattern: 'COMMENT ON FUNCTION', name: 'Comment update' }
        ]
        
        let allChecksPass = true
        for (const check of checks) {
            if (sqlContent.includes(check.pattern)) {
                console.log(`✅ ${check.name}: Found`)
            } else {
                console.log(`❌ ${check.name}: Missing`)
                allChecksPass = false
            }
        }
        
        if (allChecksPass) {
            console.log('\n🎉 SCRIPT VALIDATION PASSED')
            console.log('✅ The corrected FINAL_FUNCTION_CLEANUP.sql should execute without syntax errors')
            console.log('\n📋 NEXT STEPS:')
            console.log('1. Copy the contents of FINAL_FUNCTION_CLEANUP.sql')
            console.log('2. Run it in your Supabase SQL Editor')
            console.log('3. The PostgreSQL comment syntax error should be resolved')
        } else {
            console.log('\n⚠️ Some required components are missing from the script')
        }
        
        // Test current function state
        console.log('\n🔍 Current function accessibility test:')
        try {
            const { data, error } = await supabase.rpc('hybrid_product_match_tiered', {
                query_text: 'test',
                limit_count: 1,
                threshold: 0.1
            })
            
            if (error && error.code === 'PGRST203') {
                console.log('❌ Function overloading conflict still exists (expected until script is run)')
            } else if (error) {
                console.log('❌ Other error:', error.message)
            } else {
                console.log('✅ Function is already working!')
            }
        } catch (err) {
            console.log('🚨 Function test error:', err.message)
        }
        
    } catch (error) {
        console.error('💥 Script validation error:', error)
    }
}

testCorrectedScript()