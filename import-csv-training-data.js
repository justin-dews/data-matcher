#!/usr/bin/env node

/**
 * CSV Training Data Import Script
 * 
 * This script imports known good matches from a CSV file into the match_training_data table
 * to seed the ML learning system.
 * 
 * Expected CSV format:
 * pdf_description,catalog_description,match_quality,confidence
 * 
 * This creates direct text-to-text training data:
 * - pdf_description: Text extracted from PDF
 * - catalog_description: Matching text from your catalog
 * - ML learns: "PDF text X should match catalog text Y"
 * 
 * Usage:
 * node import-csv-training-data.js your-matches.csv
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Supabase configuration
const SUPABASE_URL = 'https://theattidfeqxyaexiqwj.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Organization ID (you may need to update this)
const ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001'

function normalizeText(text) {
  if (!text) return ''
  return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result.map(field => field.replace(/^"|"$/g, '')) // Remove surrounding quotes
}

async function findProductByDescription(catalogDescription) {
  try {
    // Get all products first, then do client-side matching to avoid SQL issues
    const { data: allProducts, error } = await supabase
      .from('products')
      .select('id, sku, name, description, manufacturer, category')
      .eq('organization_id', ORGANIZATION_ID)

    if (error) {
      console.error(`  ❌ Error fetching products:`, error)
      return null
    }

    if (!allProducts || allProducts.length === 0) {
      console.warn(`  ⚠️  No products found in catalog`)
      return null
    }

    // Find best match by similarity (client-side)
    let bestMatch = null
    let bestScore = 0
    const minScore = 0.3 // Minimum similarity threshold
    
    for (const product of allProducts) {
      const productText = product.description || product.name || product.sku || ''
      const similarity = calculateSimpleSimilarity(
        catalogDescription.toLowerCase(), 
        productText.toLowerCase()
      )
      
      if (similarity > bestScore && similarity >= minScore) {
        bestScore = similarity
        bestMatch = product
      }
    }
    
    if (bestMatch) {
      console.log(`  ✓ Found matching product: ${bestMatch.sku} - ${bestMatch.description || bestMatch.name}`)
      console.log(`    Similarity: ${(bestScore * 100).toFixed(1)}%`)
      return bestMatch
    } else {
      console.warn(`  ⚠️  No product found matching: "${catalogDescription}"`)
      console.warn(`     Best similarity was ${(bestScore * 100).toFixed(1)}% (minimum: 30%)`)
      return null
    }
    
  } catch (error) {
    console.error(`  ❌ Error in findProductByDescription:`, error.message)
    return null
  }
}

function calculateSimpleSimilarity(text1, text2) {
  // Enhanced similarity for hardware/parts matching
  const normalize = (text) => text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim()
  
  const norm1 = normalize(text1)
  const norm2 = normalize(text2)
  
  // Exact match
  if (norm1 === norm2) return 1.0
  
  // Word-based similarity
  const words1 = norm1.split(' ').filter(w => w.length > 0)
  const words2 = norm2.split(' ').filter(w => w.length > 0)
  
  if (words1.length === 0 || words2.length === 0) return 0
  
  // Count common words
  const commonWords = words1.filter(word => 
    words2.some(w2 => w2.includes(word) || word.includes(w2))
  )
  
  // Jaccard similarity with partial word matching
  const similarity = commonWords.length / Math.max(words1.length, words2.length)
  
  // Boost if one text contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return Math.max(similarity, 0.7)
  }
  
  return similarity
}

async function importTrainingData(csvFilePath) {
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV file not found: ${csvFilePath}`)
    process.exit(1)
  }

  console.log(`📂 Reading CSV file: ${csvFilePath}`)
  const csvContent = fs.readFileSync(csvFilePath, 'utf8')
  const lines = csvContent.split('\n').filter(line => line.trim())
  
  if (lines.length < 2) {
    console.error('❌ CSV file must have at least a header and one data row')
    process.exit(1)
  }

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim())
  console.log(`📋 Headers found: ${headers.join(', ')}`)

  // Validate required columns
  const requiredColumns = ['pdf_description', 'catalog_description']
  const missingColumns = requiredColumns.filter(col => !headers.includes(col))
  
  if (missingColumns.length > 0) {
    console.error(`❌ Missing required columns: ${missingColumns.join(', ')}`)
    console.error(`Required: ${requiredColumns.join(', ')}`)
    console.error(`Optional: match_quality, confidence`)
    console.error(`\nExample CSV format:`)
    console.error(`pdf_description,catalog_description,match_quality,confidence`)
    console.error(`"16-2C BLACK 500FT BOX","16AWG 2-Conductor Black Wire 500ft","excellent","0.95"`)
    process.exit(1)
  }

  console.log(`\n🚀 Processing ${lines.length - 1} training records...\n`)

  let processed = 0
  let errors = 0

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i])
    
    if (row.length < headers.length) {
      console.warn(`⚠️  Row ${i + 1}: Insufficient columns, skipping`)
      continue
    }

    try {
      const rowData = {}
      headers.forEach((header, index) => {
        rowData[header] = row[index] || ''
      })

      console.log(`\n📝 Processing row ${i}:`)
      console.log(`  PDF: "${rowData.pdf_description}"`)
      console.log(`  Catalog: "${rowData.catalog_description}"`)

      // Find the matching product in your catalog by description
      const product = await findProductByDescription(rowData.catalog_description)
      
      if (!product) {
        console.log(`  ⏩ Skipping - no matching product found`)
        continue
      }

      // Determine match quality and confidence
      let matchQuality = rowData.match_quality?.toLowerCase() || 'good'
      if (!['excellent', 'good', 'fair', 'poor'].includes(matchQuality)) {
        matchQuality = 'good'
      }

      let confidence = parseFloat(rowData.confidence) || 0.8
      confidence = Math.max(0.0, Math.min(1.0, confidence))

      // Create training data record with direct text-to-text mapping
      const trainingData = {
        organization_id: ORGANIZATION_ID,
        line_item_id: null, // No specific line item (CSV import)
        line_item_text: rowData.pdf_description,  // PDF extracted text
        line_item_normalized: normalizeText(rowData.pdf_description),
        matched_product_id: product.id,
        product_sku: product.sku,
        product_name: rowData.catalog_description, // Use actual catalog description
        product_manufacturer: product.manufacturer,
        product_category: product.category,
        trigram_score: null, // Will be calculated by ML function
        fuzzy_score: null,   // Will be calculated by ML function  
        alias_score: null,   // Will be calculated by ML function
        final_score: confidence,
        match_quality: matchQuality,
        match_confidence: confidence,
        approved_by: null,   // CSV import
        approved_at: new Date().toISOString(),
        training_weight: 1.0, // Could boost CSV imports if needed
        times_referenced: 0
      }

      const { error: insertError } = await supabase
        .from('match_training_data')
        .insert(trainingData)

      if (insertError) {
        console.error(`  ❌ Error inserting training data:`, insertError)
        errors++
      } else {
        console.log(`  ✅ Successfully imported training data`)
        processed++
      }

    } catch (error) {
      console.error(`  ❌ Error processing row ${i + 1}:`, error.message)
      errors++
    }
  }

  console.log(`\n🎯 Import Summary:`)
  console.log(`   ✅ Successfully processed: ${processed}`)
  console.log(`   ❌ Errors: ${errors}`)
  console.log(`   📊 Total training records: ${processed}`)

  if (processed > 0) {
    console.log(`\n🧠 Machine learning system is now seeded with ${processed} training examples!`)
    console.log(`   The learned similarity boost will start improving matches immediately.`)
  }
}

// Main execution
async function main() {
  const csvFile = process.argv[2]
  
  if (!csvFile) {
    console.log(`
📚 CSV Training Data Import Tool

Usage: node import-csv-training-data.js your-matches.csv

Expected CSV format:
  pdf_description,catalog_description,match_quality,confidence

Required columns:
  - pdf_description: The original text from PDF parsing
  - catalog_description: The matching text from your catalog
  
Optional columns:
  - match_quality: excellent|good|fair|poor (default: good)
  - confidence: 0.0-1.0 (default: 0.8)

Example:
  "16-2C BLACK 500FT BOX","16AWG 2-Conductor Black Wire 500ft","excellent","0.95"
  "LOOM 1/2 IN SPLIT DISPR 200F B","Split Loom Tube 1/2 Inch Dispenser","good","0.85"

This teaches the ML system: "PDF text X should match catalog text Y"
`)
    process.exit(1)
  }

  try {
    await importTrainingData(csvFile)
  } catch (error) {
    console.error('💥 Fatal error:', error.message)
    process.exit(1)
  }
}

main()