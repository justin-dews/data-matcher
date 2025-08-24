export interface CSVOptions {
  filename: string
  includeHeaders: boolean
  delimiter?: string
  encoding?: string
}

export default class CSVGenerator {
  /**
   * Generate CSV content from data array
   */
  generate(data: Record<string, any>[], options: CSVOptions): string {
    const { delimiter = ',', includeHeaders = true } = options
    
    if (!data || data.length === 0) {
      return includeHeaders ? this.getHeaders(data, delimiter) : ''
    }

    const rows: string[] = []
    
    // Add headers if requested
    if (includeHeaders) {
      const headers = Object.keys(data[0])
      rows.push(this.formatRow(headers, delimiter))
    }

    // Add data rows
    data.forEach(row => {
      const values = Object.values(row).map(value => this.formatValue(value))
      rows.push(this.formatRow(values, delimiter))
    })

    return rows.join('\n')
  }

  /**
   * Format a single row for CSV
   */
  private formatRow(values: any[], delimiter: string): string {
    return values
      .map(value => this.escapeCsvValue(String(value), delimiter))
      .join(delimiter)
  }

  /**
   * Format a value for CSV export
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return ''
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No'
    }

    if (typeof value === 'number') {
      return value.toString()
    }

    return String(value)
  }

  /**
   * Escape CSV value by wrapping in quotes if necessary
   */
  private escapeCsvValue(value: string, delimiter: string): string {
    // Check if the value contains delimiter, quotes, or newlines
    if (
      value.includes(delimiter) ||
      value.includes('"') ||
      value.includes('\n') ||
      value.includes('\r')
    ) {
      // Escape quotes by doubling them
      const escaped = value.replace(/"/g, '""')
      return `"${escaped}"`
    }

    return value
  }

  /**
   * Get headers from data structure
   */
  private getHeaders(data: Record<string, any>[], delimiter: string): string {
    if (!data || data.length === 0) {
      return ''
    }

    const headers = Object.keys(data[0])
    return this.formatRow(headers, delimiter)
  }

  /**
   * Generate CSV blob for download
   */
  generateBlob(data: Record<string, any>[], options: CSVOptions): Blob {
    const csvContent = this.generate(data, options)
    return new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    })
  }

  /**
   * Trigger CSV download in browser
   */
  downloadCsv(data: Record<string, any>[], options: CSVOptions): void {
    const blob = this.generateBlob(data, options)
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `${options.filename}.csv`
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up the URL
    URL.revokeObjectURL(url)
  }

  /**
   * Parse CSV content into data array
   */
  parse(csvContent: string, options: { hasHeaders?: boolean, delimiter?: string } = {}): Record<string, any>[] {
    const { hasHeaders = true, delimiter = ',' } = options
    
    const lines = csvContent.split('\n').filter(line => line.trim())
    if (lines.length === 0) {
      return []
    }

    let headers: string[] = []
    let dataStartIndex = 0

    if (hasHeaders) {
      headers = this.parseRow(lines[0], delimiter)
      dataStartIndex = 1
    } else {
      // Generate generic headers
      const firstRow = this.parseRow(lines[0], delimiter)
      headers = firstRow.map((_, index) => `Column${index + 1}`)
    }

    const data: Record<string, any>[] = []

    for (let i = dataStartIndex; i < lines.length; i++) {
      const values = this.parseRow(lines[i], delimiter)
      const row: Record<string, any> = {}

      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })

      data.push(row)
    }

    return data
  }

  /**
   * Parse a single CSV row
   */
  private parseRow(line: string, delimiter: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    let i = 0

    while (i < line.length) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"' && inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i += 2
      } else if (char === '"') {
        // Toggle quote state
        inQuotes = !inQuotes
        i++
      } else if (char === delimiter && !inQuotes) {
        // End of field
        result.push(current)
        current = ''
        i++
      } else {
        // Regular character
        current += char
        i++
      }
    }

    // Add the last field
    result.push(current)

    return result
  }

  /**
   * Validate CSV structure
   */
  validate(data: Record<string, any>[]): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!Array.isArray(data)) {
      errors.push('Data must be an array')
      return { valid: false, errors }
    }

    if (data.length === 0) {
      errors.push('Data array is empty')
      return { valid: false, errors }
    }

    // Check for consistent column structure
    const firstRowKeys = Object.keys(data[0])
    const inconsistentRows: number[] = []

    data.forEach((row, index) => {
      const rowKeys = Object.keys(row)
      if (rowKeys.length !== firstRowKeys.length || 
          !rowKeys.every(key => firstRowKeys.includes(key))) {
        inconsistentRows.push(index)
      }
    })

    if (inconsistentRows.length > 0) {
      errors.push(`Inconsistent column structure in rows: ${inconsistentRows.join(', ')}`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}