// Script to run RLS audit using service role key (bypasses RLS restrictions)
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabaseUrl = 'https://theattidfeqxyaexiqwj.supabase.co'
// Use service role key to bypass RLS for audit purposes
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg4MDgzMiwiZXhwIjoyMDcxNDU2ODMyfQ.7GBYmj3tobW0S6pi40YoXttfMmycxCDv9znHyE0OzXw'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runRLSAudit() {
  console.log('🔍 Starting Comprehensive RLS Audit...\n')
  
  const auditResults = {
    timestamp: new Date().toISOString(),
    tables: {},
    summary: {
      total_tables: 0,
      rls_enabled: 0,
      has_org_id: 0,
      critical_issues: [],
      recommendations: []
    }
  }

  const tables = [
    'organizations', 'profiles', 'products', 'documents', 
    'line_items', 'matches', 'competitor_aliases', 
    'product_embeddings', 'activity_log', 'settings'
  ]

  // 1. Check table structure and RLS status
  console.log('📋 1. TABLE STRUCTURE AND RLS STATUS:')
  for (const tableName of tables) {
    try {
      // Check if table exists and get basic info
      const { data: tableInfo, error: infoError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)
      
      const tableExists = !infoError
      
      if (tableExists) {
        // Get row count
        const { count: rowCount } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
        
        // Check if organization_id column exists by trying to select it
        let hasOrgId = false
        try {
          await supabase.from(tableName).select('organization_id').limit(1)
          hasOrgId = true
        } catch (e) {
          hasOrgId = false
        }
        
        auditResults.tables[tableName] = {
          exists: true,
          row_count: rowCount || 0,
          has_organization_id: hasOrgId,
          rls_enabled: null, // Will be determined by testing
          policies: [],
          issues: [],
          org_distribution: {}
        }
        
        console.log(`  ✅ ${tableName}: ${rowCount || 0} rows, org_id: ${hasOrgId ? 'YES' : 'NO'}`)
        
        // If has org_id, get distribution
        if (hasOrgId && rowCount > 0) {
          try {
            const { data: orgDist } = await supabase
              .from(tableName)
              .select('organization_id')
            
            const distribution = {}
            orgDist?.forEach(row => {
              const orgId = row.organization_id || 'NULL'
              distribution[orgId] = (distribution[orgId] || 0) + 1
            })
            
            auditResults.tables[tableName].org_distribution = distribution
            console.log(`    Org distribution:`, Object.entries(distribution).map(([k,v]) => `${k.slice(0,8)}...: ${v}`).join(', '))
          } catch (e) {
            console.log(`    Could not get org distribution: ${e.message}`)
          }
        }
        
      } else {
        auditResults.tables[tableName] = {
          exists: false,
          error: infoError?.message
        }
        console.log(`  ❌ ${tableName}: Table not found`)
      }
      
      auditResults.summary.total_tables++
      if (auditResults.tables[tableName]?.has_organization_id) {
        auditResults.summary.has_org_id++
      }
      
    } catch (error) {
      console.log(`  💥 ${tableName}: Error - ${error.message}`)
      auditResults.tables[tableName] = {
        exists: false,
        error: error.message
      }
    }
  }

  // 2. Test RLS enforcement by attempting queries with anon key
  console.log('\n🔒 2. TESTING RLS ENFORCEMENT:')
  const anonClient = createClient(supabaseUrl, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZWF0dGlkZmVxeHlhZXhpcXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4ODA4MzIsImV4cCI6MjA3MTQ1NjgzMn0.B-qWDnZRkxToVhhpMDVgXD38fzOptalciTDHxXOkgHI')
  
  for (const tableName of tables) {
    if (!auditResults.tables[tableName]?.exists) continue
    
    try {
      const { data: anonData, error: anonError } = await anonClient
        .from(tableName)
        .select('*')
        .limit(1)
      
      const isBlocked = anonError && anonError.message.includes('policy')
      const rlsEnabled = isBlocked || (anonData && anonData.length === 0)
      
      auditResults.tables[tableName].rls_enabled = rlsEnabled
      
      if (rlsEnabled) {
        console.log(`  🔒 ${tableName}: RLS ENABLED (${isBlocked ? 'blocked' : 'empty result'})`)
        auditResults.summary.rls_enabled++
      } else {
        console.log(`  🚨 ${tableName}: RLS DISABLED - Data accessible without auth!`)
        auditResults.tables[tableName].issues.push('RLS_DISABLED')
        auditResults.summary.critical_issues.push(`${tableName}: RLS disabled`)
      }
      
    } catch (error) {
      console.log(`  ⚠️  ${tableName}: Could not test RLS - ${error.message}`)
    }
  }

  // 3. Analyze critical issues
  console.log('\n🚨 3. CRITICAL ISSUES IDENTIFIED:')
  
  for (const [tableName, info] of Object.entries(auditResults.tables)) {
    if (!info.exists) continue
    
    // Tables that should have organization_id but don't
    if (['products', 'documents', 'line_items', 'matches', 'competitor_aliases', 'product_embeddings', 'activity_log', 'settings'].includes(tableName)) {
      if (!info.has_organization_id) {
        const issue = `${tableName}: Missing organization_id column`
        console.log(`  💥 ${issue}`)
        auditResults.summary.critical_issues.push(issue)
        auditResults.summary.recommendations.push(`Add organization_id to ${tableName}`)
      }
    }
    
    // Tables that should have RLS enabled but don't  
    if (['products', 'documents', 'line_items', 'matches', 'competitor_aliases', 'product_embeddings', 'activity_log', 'settings'].includes(tableName)) {
      if (!info.rls_enabled) {
        const issue = `${tableName}: RLS disabled`
        console.log(`  🔓 ${issue}`)
        auditResults.summary.critical_issues.push(issue)
        auditResults.summary.recommendations.push(`Enable RLS on ${tableName}`)
      }
    }
  }

  // 4. Special focus on products table (the main issue)
  console.log('\n🎯 4. PRODUCTS TABLE DEEP DIVE (Root cause of matching failures):')
  if (auditResults.tables.products?.exists) {
    const productsInfo = auditResults.tables.products
    console.log(`  Total products: ${productsInfo.row_count}`)
    console.log(`  Has organization_id: ${productsInfo.has_organization_id}`)
    console.log(`  RLS enabled: ${productsInfo.rls_enabled}`)
    console.log(`  Org distribution:`, productsInfo.org_distribution)
    
    if (productsInfo.row_count > 0 && productsInfo.rls_enabled) {
      console.log(`  🔍 ROOT CAUSE IDENTIFIED: Products exist (${productsInfo.row_count}) but RLS blocks API access`)
      console.log(`     This explains why hybrid_product_match fails and matches page shows 0 products`)
    }
  } else {
    console.log(`  ❌ Products table not found - this is a critical issue`)
  }

  // 5. Generate summary and recommendations
  console.log('\n📊 5. AUDIT SUMMARY:')
  console.log(`  Total tables audited: ${auditResults.summary.total_tables}`)
  console.log(`  Tables with organization_id: ${auditResults.summary.has_org_id}`)
  console.log(`  Tables with RLS enabled: ${auditResults.summary.rls_enabled}`)
  console.log(`  Critical issues found: ${auditResults.summary.critical_issues.length}`)
  
  console.log('\n🎯 6. TOP PRIORITY FIXES:')
  auditResults.summary.recommendations.forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec}`)
  })

  // Save detailed results to file
  const auditReport = {
    ...auditResults,
    generated_at: new Date().toISOString(),
    next_steps: [
      'Fix RLS policies on tables with existing organization_id columns',
      'Add organization_id columns to tables that are missing them',
      'Create proper RLS policies for multi-tenant isolation',
      'Test data access with corrected policies'
    ]
  }

  fs.writeFileSync('rls_audit_results.json', JSON.stringify(auditReport, null, 2))
  
  console.log('\n✅ RLS Audit Complete!')
  console.log('📄 Detailed results saved to: rls_audit_results.json')
  console.log('\n🚀 Ready to proceed to Phase 1.2: RLS Policy Design')
  
  return auditReport
}

// Run the audit
runRLSAudit().catch(console.error)