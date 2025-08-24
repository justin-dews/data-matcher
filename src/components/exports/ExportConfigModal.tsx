'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../../app/providers'
import { XMarkIcon } from '@heroicons/react/24/outline'
import CSVGenerator from '@/lib/csvGenerator'
import { cn } from '@/lib/utils'

export interface ExportConfig {
  name: string
  columns: string[]
  filters: {
    status?: string[]
    dateRange?: {
      start: string
      end: string
    }
    confidenceThreshold?: number
  }
  includeWriteBack: boolean
  format: 'csv' | 'xlsx'
}

interface ExportConfigModalProps {
  onClose: () => void
  onExport: (config: ExportConfig) => Promise<void>
}

const AVAILABLE_COLUMNS = [
  { id: 'line_item.raw_text', label: 'Original Text', category: 'Line Item' },
  { id: 'line_item.parsed_data.name', label: 'Parsed Product Name', category: 'Line Item' },
  { id: 'line_item.parsed_data.quantity', label: 'Quantity', category: 'Line Item' },
  { id: 'line_item.parsed_data.price', label: 'Unit Price', category: 'Line Item' },
  { id: 'line_item.total_price', label: 'Total Price', category: 'Line Item' },
  { id: 'product.sku', label: 'Matched SKU', category: 'Product' },
  { id: 'product.name', label: 'Matched Product Name', category: 'Product' },
  { id: 'product.manufacturer', label: 'Manufacturer', category: 'Product' },
  { id: 'product.category', label: 'Category', category: 'Product' },
  { id: 'product.price', label: 'Catalog Price', category: 'Product' },
  { id: 'match.status', label: 'Match Status', category: 'Match' },
  { id: 'match.confidence_score', label: 'Confidence Score', category: 'Match' },
  { id: 'match.final_score', label: 'Final Score', category: 'Match' },
  { id: 'match.matched_text', label: 'Matched Text', category: 'Match' },
  { id: 'match.reasoning', label: 'Match Reasoning', category: 'Match' },
  { id: 'document.filename', label: 'Source Document', category: 'Document' },
]

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'auto_matched', label: 'Auto-matched' },
]

export default function ExportConfigModal({ onClose, onExport }: ExportConfigModalProps) {
  const { user } = useAuth()
  const [config, setConfig] = useState<ExportConfig>({
    name: `Export ${new Date().toLocaleDateString()}`,
    columns: [
      'line_item.raw_text',
      'line_item.parsed_data.name', 
      'product.sku',
      'product.name',
      'match.status',
      'match.confidence_score'
    ],
    filters: {},
    includeWriteBack: false,
    format: 'csv'
  })
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleColumnToggle = (columnId: string) => {
    setConfig(prev => ({
      ...prev,
      columns: prev.columns.includes(columnId)
        ? prev.columns.filter(col => col !== columnId)
        : [...prev.columns, columnId]
    }))
  }

  const handleStatusFilter = (status: string) => {
    setConfig(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        status: prev.filters.status?.includes(status)
          ? prev.filters.status.filter(s => s !== status)
          : [...(prev.filters.status || []), status]
      }
    }))
  }

  const handleExport = useCallback(async () => {
    if (!user || !user.organization_id || config.columns.length === 0) return

    setIsExporting(true)
    setExportProgress(0)
    setError(null)

    try {
      // Log export start
      const { data: logEntry } = await supabase
        .from('activity_log')
        .insert({
          organization_id: user.organization_id!,
          user_id: user.id,
          action: 'export_start',
          resource_type: 'export',
          metadata: {
            export_name: config.name,
            columns: config.columns,
            filters: config.filters,
            format: config.format,
            include_write_back: config.includeWriteBack,
            status: 'preparing'
          }
        })
        .select()
        .single()

      const exportId = logEntry?.id

      // Build query with filters
      let query = supabase
        .from('line_items')
        .select(`
          *,
          match:matches(
            *,
            product:products(*)
          ),
          document:documents(filename, created_at)
        `)
        .eq('organization_id', user.organization_id!)

      // Apply filters
      if (config.filters.status && config.filters.status.length > 0) {
        query = query.in('matches.status', config.filters.status)
      }

      if (config.filters.dateRange) {
        query = query.gte('created_at', config.filters.dateRange.start)
                    .lte('created_at', config.filters.dateRange.end)
      }

      if (config.filters.confidenceThreshold) {
        query = query.gte('matches.confidence_score', config.filters.confidenceThreshold)
      }

      setExportProgress(25)

      const { data, error: fetchError } = await query.limit(10000) // Reasonable limit

      if (fetchError) throw fetchError

      setExportProgress(50)

      // Transform data for export
      const transformedData = data?.map(item => {
        const row: Record<string, any> = {}
        
        config.columns.forEach(column => {
          const parts = column.split('.')
          let value = item

          // Navigate through nested objects
          for (const part of parts) {
            if (value && typeof value === 'object') {
              if (part === 'match') {
                value = Array.isArray(value[part]) ? value[part][0] : value[part]
              } else {
                value = value[part]
              }
            } else {
              value = null
              break
            }
          }

          // Format the column name for CSV header
          const columnLabel = AVAILABLE_COLUMNS.find(col => col.id === column)?.label || column
          row[columnLabel] = value || ''
        })

        return row
      }) || []

      setExportProgress(75)

      // Generate CSV
      const csvGenerator = new CSVGenerator()
      const csvContent = csvGenerator.generate(transformedData, {
        filename: config.name,
        includeHeaders: true
      })

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${config.name}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setExportProgress(90)

      // Write back to database if requested
      if (config.includeWriteBack) {
        const approvedMatches = data?.filter(item => 
          item.match && item.match[0]?.status === 'approved'
        ) || []

        for (const item of approvedMatches) {
          const match = Array.isArray(item.match) ? item.match[0] : item.match
          if (match?.product_id) {
            await supabase
              .from('matches')
              .update({
                status: 'exported',
                updated_at: new Date().toISOString()
              })
              .eq('id', match.id)
          }
        }
      }

      setExportProgress(100)

      // Log completion
      if (exportId) {
        await supabase
          .from('activity_log')
          .update({
            metadata: {
              export_name: config.name,
              columns: config.columns,
              filters: config.filters,
              format: config.format,
              include_write_back: config.includeWriteBack,
              status: 'completed',
              total_records: transformedData.length,
              processed_records: transformedData.length,
              file_path: `${config.name}.csv`
            }
          })
          .eq('id', exportId)
      }

      // Final activity log for CSV export
      await supabase
        .from('activity_log')
        .insert({
          organization_id: user.organization_id!,
          user_id: user.id,
          action: 'export_csv',
          resource_type: 'export',
          metadata: {
            export_name: config.name,
            columns: config.columns,
            filters: config.filters,
            format: config.format,
            include_write_back: config.includeWriteBack,
            status: 'completed',
            total_records: transformedData.length,
            processed_records: transformedData.length,
            file_path: `${config.name}.csv`
          }
        })

      await onExport(config)

    } catch (err) {
      console.error('Export error:', err)
      setError(err instanceof Error ? err.message : 'Export failed')
      
      // Log error
      await supabase
        .from('activity_log')
        .insert({
          organization_id: user.organization_id!,
          user_id: user.id,
          action: 'export_failed',
          resource_type: 'export',
          metadata: {
            export_name: config.name,
            error: err instanceof Error ? err.message : 'Unknown error',
            status: 'failed'
          }
        })
    } finally {
      setIsExporting(false)
    }
  }, [user, config, onExport])

  const groupedColumns = AVAILABLE_COLUMNS.reduce((groups, column) => {
    const category = column.category
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(column)
    return groups
  }, {} as Record<string, typeof AVAILABLE_COLUMNS>)

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">Configure Export</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isExporting}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Export Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Name
            </label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isExporting}
            />
          </div>

          {/* Column Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Columns to Export
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(groupedColumns).map(([category, columns]) => (
                <div key={category} className="border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">{category}</h4>
                  <div className="space-y-2">
                    {columns.map(column => (
                      <label key={column.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={config.columns.includes(column.id)}
                          onChange={() => handleColumnToggle(column.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          disabled={isExporting}
                        />
                        <span className="ml-2 text-sm text-gray-700">{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <div className="space-y-2">
                {STATUS_OPTIONS.map(status => (
                  <label key={status.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.filters.status?.includes(status.value) || false}
                      onChange={() => handleStatusFilter(status.value)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={isExporting}
                    />
                    <span className="ml-2 text-sm text-gray-700">{status.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Confidence Threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Confidence Score
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={config.filters.confidenceThreshold || ''}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  filters: {
                    ...prev.filters,
                    confidenceThreshold: e.target.value ? parseFloat(e.target.value) : undefined
                  }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="0.7"
                disabled={isExporting}
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.includeWriteBack}
                onChange={(e) => setConfig(prev => ({ ...prev, includeWriteBack: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={isExporting}
              />
              <span className="ml-2 text-sm text-gray-700">
                Write back confirmed matches to database (mark as exported)
              </span>
            </label>
          </div>

          {/* Export Progress */}
          {isExporting && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Exporting...</span>
                <span>{exportProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || config.columns.length === 0}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
              isExporting || config.columns.length === 0
                ? "text-gray-400 bg-gray-200 cursor-not-allowed"
                : "text-white bg-blue-600 hover:bg-blue-700"
            )}
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>
    </div>
  )
}