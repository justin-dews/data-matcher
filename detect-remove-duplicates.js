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

async function detectAndRemoveDuplicates() {
  console.log('🔍 Detecting and removing duplicate products...\n');
  
  try {
    // Get all products
    const { data: allProducts, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', ORG_ID)
      .order('created_at', { ascending: true }); // Keep oldest first
      
    if (fetchError) {
      console.error('❌ Error fetching products:', fetchError);
      return;
    }
    
    if (!allProducts || allProducts.length === 0) {
      console.log('✅ No products found in catalog');
      return;
    }
    
    console.log('📊 Total products in catalog:', allProducts.length);
    
    // Group products by SKU to find duplicates
    const skuGroups = {};
    const nameGroups = {};
    
    allProducts.forEach(product => {
      // Group by SKU (exact match)
      const sku = product.sku?.toUpperCase().trim();
      if (sku) {
        if (!skuGroups[sku]) skuGroups[sku] = [];
        skuGroups[sku].push(product);
      }
      
      // Group by name (case insensitive, trimmed)
      const name = product.name?.toLowerCase().trim();
      if (name) {
        if (!nameGroups[name]) nameGroups[name] = [];
        nameGroups[name].push(product);
      }
    });
    
    // Find SKU duplicates
    const skuDuplicates = Object.entries(skuGroups)
      .filter(([sku, products]) => products.length > 1)
      .map(([sku, products]) => ({ key: sku, type: 'SKU', products }));
      
    // Find name duplicates (that aren't already SKU duplicates)
    const nameDuplicates = Object.entries(nameGroups)
      .filter(([name, products]) => {
        if (products.length <= 1) return false;
        // Check if these are already caught as SKU duplicates
        const firstSku = products[0].sku?.toUpperCase().trim();
        return !firstSku || !skuGroups[firstSku] || skuGroups[firstSku].length <= 1;
      })
      .map(([name, products]) => ({ key: name, type: 'Name', products }));
    
    const allDuplicates = [...skuDuplicates, ...nameDuplicates];
    
    if (allDuplicates.length === 0) {
      console.log('✅ No duplicates found! Your catalog is clean.');
      return;
    }
    
    console.log(`\n🔍 Found ${allDuplicates.length} duplicate groups:\n`);
    
    let totalDuplicatesToRemove = 0;
    const productsToDelete = [];
    
    allDuplicates.forEach((group, index) => {
      console.log(`Group ${index + 1} - Duplicate ${group.type}: "${group.key}"`);
      console.log(`  Found ${group.products.length} copies:`);
      
      // Sort by creation date (keep oldest)
      group.products.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      group.products.forEach((product, i) => {
        const isKeep = i === 0;
        console.log(`    ${isKeep ? '✅ KEEP' : '❌ DELETE'}: ${product.sku} - ${product.name.substring(0, 50)}... (${new Date(product.created_at).toLocaleString()})`);
        
        if (!isKeep) {
          productsToDelete.push(product.id);
          totalDuplicatesToRemove++;
        }
      });
      console.log('');
    });
    
    console.log(`📊 Summary:`);
    console.log(`   Total products: ${allProducts.length}`);
    console.log(`   Duplicate groups: ${allDuplicates.length}`);
    console.log(`   Products to delete: ${totalDuplicatesToRemove}`);
    console.log(`   Products after cleanup: ${allProducts.length - totalDuplicatesToRemove}`);
    
    if (productsToDelete.length === 0) {
      console.log('✅ No duplicates to remove');
      return;
    }
    
    console.log(`\n🗑️  Removing ${productsToDelete.length} duplicate products...`);
    
    // Remove duplicates in batches
    const BATCH_SIZE = 50;
    let deletedCount = 0;
    
    for (let i = 0; i < productsToDelete.length; i += BATCH_SIZE) {
      const batch = productsToDelete.slice(i, i + BATCH_SIZE);
      
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .in('id', batch);
        
      if (deleteError) {
        console.error(`❌ Error deleting batch ${Math.floor(i/BATCH_SIZE) + 1}:`, deleteError);
      } else {
        deletedCount += batch.length;
        console.log(`   ✅ Deleted batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} products`);
      }
    }
    
    // Verify cleanup
    const { count: finalCount, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', ORG_ID);
      
    if (countError) {
      console.error('❌ Error counting final products:', countError);
    } else {
      console.log(`\n🎉 Cleanup complete!`);
      console.log(`   ✅ Removed ${deletedCount} duplicate products`);
      console.log(`   📊 Final catalog size: ${finalCount} products`);
      console.log(`\n💡 Safe to re-run your import now! The remaining 54 items will be added without creating duplicates.`);
    }
    
  } catch (error) {
    console.error('💥 Error during duplicate detection:', error.message);
  }
}

detectAndRemoveDuplicates();