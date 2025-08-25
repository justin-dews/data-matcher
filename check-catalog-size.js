#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '00000000-0000-0000-0000-000000000001';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('💡 Run: export SUPABASE_SERVICE_ROLE_KEY="your-key"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkCatalogSize() {
  console.log('📊 Checking current catalog size...\n');
  
  try {
    // Count total products
    const { count: totalCount, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ORG_ID);
      
    if (countError) {
      console.error('❌ Error counting products:', countError);
      return;
    }
    
    console.log('📊 Total products in catalog:', totalCount || 0);
    
    // Get recent products (last 10)
    const { data: recentProducts, error: recentError } = await supabase
      .from('products')
      .select('sku, name, created_at')
      .eq('organization_id', ORG_ID)
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (recentError) {
      console.error('❌ Error fetching recent products:', recentError);
      return;
    }
    
    if (recentProducts && recentProducts.length > 0) {
      console.log('\n📋 10 most recently added products:');
      recentProducts.forEach((product, i) => {
        console.log(`  ${i + 1}. ${product.sku} - ${product.name.substring(0, 50)}...`);
        console.log(`     Added: ${new Date(product.created_at).toLocaleString()}`);
      });
    }
    
    // Check import metadata to see when products were added
    const { data: importStats, error: importError } = await supabase
      .from('products')
      .select('metadata, created_at')
      .eq('organization_id', ORG_ID)
      .not('metadata', 'is', null);
      
    if (!importError && importStats) {
      const importSources = {};
      importStats.forEach(product => {
        if (product.metadata && product.metadata.import_source) {
          const source = product.metadata.import_source;
          if (!importSources[source]) {
            importSources[source] = [];
          }
          importSources[source].push(product.created_at);
        }
      });
      
      if (Object.keys(importSources).length > 0) {
        console.log('\n📁 Import history:');
        Object.entries(importSources).forEach(([source, dates]) => {
          console.log(`  ${source}: ${dates.length} products`);
          const oldestDate = new Date(Math.min(...dates.map(d => new Date(d).getTime())));
          const newestDate = new Date(Math.max(...dates.map(d => new Date(d).getTime())));
          console.log(`    First: ${oldestDate.toLocaleString()}`);
          console.log(`    Last: ${newestDate.toLocaleString()}`);
        });
      }
    }
    
    // Summary
    console.log('\n🎯 Summary:');
    if ((totalCount || 0) === 250) {
      console.log('✅ You have exactly 250 products - your import was already complete!');
    } else if ((totalCount || 0) > 250) {
      console.log(`ℹ️  You have ${totalCount} products - more than the 250 from your CSV`);
      console.log('   This suggests you have additional products from other sources');
    } else {
      console.log(`⚠️  You have ${totalCount} products - less than the expected 250`);
      console.log('   There might be an issue with the import or duplicate detection');
    }
    
    console.log('\n🚀 Ready to test ML-enhanced matching with your catalog!');
    
  } catch (error) {
    console.error('💥 Error checking catalog:', error.message);
  }
}

checkCatalogSize();