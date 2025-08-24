import { NextRequest, NextResponse } from 'next/server'
import { parse as parseCSV } from 'csv-parse/sync'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    let data: any[] = []
    
    // Parse based on file type
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      // Parse CSV
      let csvText = await file.text()
      // Remove BOM if present
      csvText = csvText.replace(/^\uFEFF/, '')
      
      data = parseCSV(csvText, {
        columns: true, // Use first row as headers
        skip_empty_lines: true,
        trim: true,
        bom: true // Handle BOM characters
      })
    } else if (
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')
    ) {
      // Parse Excel
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      data = XLSX.utils.sheet_to_json(worksheet)
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please use CSV or Excel files.' },
        { status: 400 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'No data found in file' },
        { status: 400 }
      )
    }

    // Clean and validate data based on type
    if (type === 'products') {
      data = data.map((row: any, index: number) => {
        // Clean up common column name variations
        const cleanedRow: any = {}
        
        Object.keys(row).forEach(key => {
          const cleanKey = key.trim().toLowerCase().replace(/[^\w\s]/g, '') // Remove special chars
          const value = row[key]
          
          // Map common column variations to standard names
          if (['sku', 'product_code', 'item_id', 'part_number', 'item_no', 'itemno', 'item no'].includes(cleanKey)) {
            cleanedRow.sku = String(value || '').trim()
          } else if (['name', 'product_name', 'title', 'item_description', 'item description', 'description'].includes(cleanKey) && !cleanedRow.name) {
            cleanedRow.name = String(value || '').trim()
          } else if (['description', 'desc', 'details', 'item_description', 'item description'].includes(cleanKey) && !cleanedRow.name) {
            cleanedRow.description = String(value || '').trim()
          } else if (['category', 'cat', 'type'].includes(cleanKey)) {
            cleanedRow.category = String(value || '').trim()
          } else if (['manufacturer', 'brand', 'vendor', 'supplier'].includes(cleanKey)) {
            cleanedRow.manufacturer = String(value || '').trim()
          } else if (['price', 'cost', 'amount', 'value'].includes(cleanKey)) {
            const numValue = parseFloat(String(value || '0').replace(/[$,]/g, ''))
            cleanedRow.price = isNaN(numValue) ? 0 : numValue
          } else {
            // Keep other columns as metadata
            cleanedRow[key] = value
          }
        })
        
        // Ensure required fields
        if (!cleanedRow.sku) {
          cleanedRow.sku = `IMPORT-${index + 1}`
        }
        if (!cleanedRow.name) {
          cleanedRow.name = cleanedRow.sku || `Product ${index + 1}`
        }
        
        return cleanedRow
      })
    }

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      preview: data.slice(0, 10) // First 10 rows for preview
    })

  } catch (error: any) {
    console.error('Error parsing file:', error)
    
    return NextResponse.json(
      { error: `Failed to parse file: ${error.message}` },
      { status: 500 }
    )
  }
}