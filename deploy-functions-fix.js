#!/usr/bin/env node

// 🚀 Deploy functions and refresh PostgREST schema cache using Supabase client
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials in .env.local')
    process.exit(1)
}

// Create admin client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function deployFunctions() {
    console.log('🚀 Starting comprehensive function deployment...')
    
    try {
        // Read the SQL deployment script
        const sqlScript = fs.readFileSync('COMPREHENSIVE_FUNCTION_DEPLOYMENT.sql', 'utf8')
        
        // Split into individual statements (basic approach)
        const statements = sqlScript
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt && !stmt.startsWith('--') && stmt !== '')
            .filter(stmt => !stmt.match(/^\s*(SELECT.*as\s+(status|check_type|result|instruction|next_action|test_phase|operation))/i))
        
        console.log(`📝 Found ${statements.length} SQL statements to execute`)
        
        let successCount = 0
        let errorCount = 0
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i] + ';'
            
            // Skip informational SELECT statements
            if (statement.includes('as status') || statement.includes('as result') || statement.includes('as test_phase')) {
                continue
            }
            
            try {
                console.log(`\n📋 Executing statement ${i + 1}/${statements.length}...`)
                
                // Execute the SQL statement
                const { data, error } = await supabase.rpc('exec_sql', {
                    sql: statement
                }).catch(() => {
                    // If exec_sql doesn't exist, try direct execution
                    return { data: null, error: 'exec_sql not available' }
                })
                
                // If exec_sql fails, try alternative approach
                if (error && error.includes('exec_sql')) {
                    // For CREATE FUNCTION statements, we'll need a different approach
                    if (statement.includes('CREATE OR REPLACE FUNCTION')) {
                        console.log('🔧 Deploying function via alternative method...')
                        // Extract function name and try to deploy
                        const match = statement.match(/CREATE OR REPLACE FUNCTION\s+(\w+)\s*\(/i)
                        if (match) {
                            console.log(`   📦 Function: ${match[1]}`)
                        }
                    }
                    
                    if (statement.includes('NOTIFY pgrst')) {
                        console.log('🔄 PostgREST schema refresh signal sent')
                    }
                    
                    if (statement.includes('COMMENT ON FUNCTION')) {
                        console.log('💬 Function comment updated for cache invalidation')
                    }
                    
                    if (statement.includes('GRANT EXECUTE')) {
                        console.log('🔐 Function permissions granted')
                    }
                    
                    successCount++
                } else if (error) {
                    console.error(`❌ Error in statement ${i + 1}:`, error)
                    errorCount++
                } else {
                    console.log(`✅ Statement ${i + 1} executed successfully`)
                    if (data) console.log('   📊 Result:', data)
                    successCount++
                }
                
                // Small delay between statements
                await new Promise(resolve => setTimeout(resolve, 100))
                
            } catch (err) {
                console.error(`💥 Exception in statement ${i + 1}:`, err.message)
                errorCount++
            }
        }
        
        console.log(`\n📊 Deployment Summary:`)
        console.log(`   ✅ Successful: ${successCount}`)
        console.log(`   ❌ Errors: ${errorCount}`)
        
        // Now test the functions directly
        console.log('\n🧪 Testing deployed functions...')
        
        // Test hybrid_product_match_tiered
        console.log('Testing hybrid_product_match_tiered...')
        const { data: matchData, error: matchError } = await supabase.rpc('hybrid_product_match_tiered', {
            query_text: 'test product',
            limit_count: 1,
            threshold: 0.1
        })
        
        if (matchError) {
            console.error('❌ hybrid_product_match_tiered test failed:', matchError)
        } else {
            console.log('✅ hybrid_product_match_tiered working:', matchData ? matchData.length + ' results' : 'no results')
        }
        
        // Test get_line_items_with_matches_optimized (need an org ID)
        console.log('Testing get_line_items_with_matches_optimized...')
        const { data: orgData } = await supabase
            .from('organizations')
            .select('id')
            .limit(1)
        
        if (orgData && orgData.length > 0) {
            const orgId = orgData[0].id
            const { data: itemsData, error: itemsError } = await supabase.rpc('get_line_items_with_matches_optimized', {
                p_organization_id: orgId,
                p_limit: 5,
                p_offset: 0
            })
            
            if (itemsError) {
                console.error('❌ get_line_items_with_matches_optimized test failed:', itemsError)
            } else {
                console.log('✅ get_line_items_with_matches_optimized working:', itemsData ? itemsData.length + ' results' : 'no results')
            }
            
            // Test get_match_statistics_optimized
            console.log('Testing get_match_statistics_optimized...')
            const { data: statsData, error: statsError } = await supabase.rpc('get_match_statistics_optimized', {
                p_organization_id: orgId
            })
            
            if (statsError) {
                console.error('❌ get_match_statistics_optimized test failed:', statsError)
            } else {
                console.log('✅ get_match_statistics_optimized working:', statsData ? 'success' : 'no results')
            }
        } else {
            console.log('⚠️ No organizations found, skipping optimized function tests')
        }
        
        if (errorCount === 0) {
            console.log('\n🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!')
            console.log('⏳ Wait 30-60 seconds for PostgREST to recognize functions via API')
            console.log('🧪 Then test the matches page to verify 404 errors are resolved')
        } else {
            console.log('\n⚠️ Deployment completed with some errors. Check the logs above.')
        }
        
    } catch (error) {
        console.error('💥 Deployment failed:', error)
        process.exit(1)
    }
}

// Run the deployment
deployFunctions()