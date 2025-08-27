#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = 'b903b88d-e667-4dde-94ff-79dbbb1fcb38'; // Service import user

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim().replace(/^"|"$/g, ''));
    
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }
  }
  
  return rows;
}

function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function importTrainingData(csvFilePath) {
  console.log('📊 Importing training data from CSV...\n');
  
  try {
    // Read and parse CSV file
    if (!fs.existsSync(csvFilePath)) {
      console.error(`❌ CSV file not found: ${csvFilePath}`);
      console.log('\n💡 Expected CSV format:');
      console.log('   item_description,catalog_product_sku,catalog_product_description');
      console.log('   "GR. 8 HX HD CAP SCR 5/16-18X2-1/2","56X212C8","HEX CAP SCREW BOLT UNC ZINC 5/16-18 X 2-1/2, GR 8"');
      return;
    }
    
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const csvData = parseCSV(csvContent);
    
    console.log(`📋 Parsed ${csvData.length} records from CSV`);
    
    // Validate CSV structure
    const requiredColumns = ['item_description', 'catalog_product_sku', 'catalog_product_description'];
    const headers = Object.keys(csvData[0] || {});
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      console.error(`❌ Missing required columns: ${missingColumns.join(', ')}`);
      console.log('💡 Required columns: item_description, catalog_product_sku, catalog_product_description');
      return;
    }
    
    // Clear existing training data
    console.log('\n🧹 Clearing existing training data...');
    const { error: clearError, count: clearCount } = await supabase
      .from('match_training_data')
      .delete({ count: 'exact' })
      .eq('organization_id', ORG_ID);
      
    if (clearError) {
      console.error('❌ Error clearing training data:', clearError);
      return;
    }
    
    console.log(`✅ Cleared ${clearCount} existing training records`);
    
    // Process CSV records
    console.log('\n📝 Processing CSV records...');
    const trainingRecords = [];
    const errors = [];
    
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowNum = i + 2; // +2 because CSV has header and is 1-indexed
      
      try {
        // Validate required fields
        if (!row.item_description?.trim()) {
          errors.push(`Row ${rowNum}: Missing item_description`);
          continue;
        }
        
        if (!row.catalog_product_sku?.trim()) {
          errors.push(`Row ${rowNum}: Missing catalog_product_sku`);
          continue;
        }
        
        if (!row.catalog_product_description?.trim()) {
          errors.push(`Row ${rowNum}: Missing catalog_product_description`);
          continue;
        }
        
        // Verify the product exists in our catalog
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, sku, name, manufacturer, category')
          .eq('organization_id', ORG_ID)
          .eq('sku', row.catalog_product_sku.trim())
          .single();
          
        if (productError || !product) {
          errors.push(`Row ${rowNum}: Product not found in catalog: ${row.catalog_product_sku}`);
          continue;
        }
        
        // Create training record
        const trainingRecord = {
          organization_id: ORG_ID,
          line_item_id: null, // No specific line item, this is seed data
          line_item_text: row.item_description.trim(),
          line_item_normalized: normalizeText(row.item_description),
          matched_product_id: product.id,
          product_sku: product.sku,
          product_name: product.name,
          product_manufacturer: product.manufacturer,
          product_category: product.category,
          trigram_score: null, // Not applicable for exact imports
          fuzzy_score: null,   // Not applicable for exact imports  
          alias_score: null,   // Not applicable for exact imports
          final_score: 1.0,    // Perfect match for imported data
          match_quality: 'excellent', // All imports are excellent
          match_confidence: 1.0,      // 100% confidence for exact matches
          approved_by: USER_ID,
          approved_at: new Date().toISOString(),
          training_weight: 1.0,
          times_referenced: 0,
          last_referenced_at: null
        };
        
        trainingRecords.push(trainingRecord);
        
        if ((i + 1) % 10 === 0) {
          console.log(`   Processed ${i + 1}/${csvData.length} records...`);
        }
        
      } catch (error) {
        errors.push(`Row ${rowNum}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Processing complete:`);
    console.log(`   Total CSV records: ${csvData.length}`);
    console.log(`   Valid training records: ${trainingRecords.length}`);
    console.log(`   Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.slice(0, 10).forEach(error => console.log(`   ${error}`));
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more errors`);
      }
    }
    
    if (trainingRecords.length === 0) {
      console.log('\n❌ No valid training records to import!');
      return;
    }
    
    // Insert training records in batches
    console.log(`\n💾 Inserting ${trainingRecords.length} training records...`);
    const batchSize = 50;
    let inserted = 0;
    
    for (let i = 0; i < trainingRecords.length; i += batchSize) {
      const batch = trainingRecords.slice(i, i + batchSize);
      
      const { error: insertError, count } = await supabase
        .from('match_training_data')
        .insert(batch, { count: 'exact' });
        
      if (insertError) {
        console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, insertError);
        break;
      } else {
        inserted += count || batch.length;
        console.log(`   ✅ Inserted batch ${Math.floor(i/batchSize) + 1}: ${count} records`);
      }
    }
    
    console.log(`\n🎉 Training data import complete!`);
    console.log(`   Successfully imported: ${inserted} records`);
    console.log(`   Data quality: All records are 'excellent' with 1.0 confidence`);
    console.log(`   Ready for tiered matching system!`);
    
  } catch (error) {
    console.error('💥 Import error:', error);
  }
}

// Usage
const csvFile = process.argv[2];

if (!csvFile) {
  console.log('📊 Training Data Import Tool');
  console.log('\nUsage:');
  console.log('  node import-training-data.js <csv-file-path>');
  console.log('\n📋 CSV Format:');
  console.log('  item_description,catalog_product_sku,catalog_product_description');
  console.log('  "GR. 8 HX HD CAP SCR 5/16-18X2-1/2","56X212C8","HEX CAP SCREW BOLT UNC ZINC 5/16-18 X 2-1/2, GR 8"');
  console.log('\n💡 Notes:');
  console.log('  - All imported matches are set to "excellent" quality with 1.0 confidence');
  console.log('  - The catalog_product_sku must exist in your products table');
  console.log('  - Existing training data will be cleared before import');
  process.exit(1);
}

importTrainingData(csvFile);