'use client'

import { useState } from 'react'
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { cn, formatCurrency } from '@/lib/utils'

export interface LineItem {
  id: string
  item_number?: string
  part_number?: string
  description?: string
  raw_text: string
  normalized_text: string
  quantity: number | null
  unit_price: number | null
  total?: number | null
  position: number
  source_line?: number
  uom?: string
  raw_row?: string
}

interface ExtractedDataTableProps {
  lineItems: LineItem[]
  onLineItemUpdate: (lineItemId: string, updates: Partial<LineItem>) => void
}

interface EditingCell {
  rowId: string
  field: string
}

export default function ExtractedDataTable({ lineItems, onLineItemUpdate }: ExtractedDataTableProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
  const [editValue, setEditValue] = useState<string>('')

  const handleStartEdit = (rowId: string, field: string, currentValue: any) => {
    setEditingCell({ rowId, field })
    setEditValue(currentValue?.toString() || '')
  }

  const handleSaveEdit = () => {
    if (!editingCell) return

    const { rowId, field } = editingCell
    let parsedValue: any = editValue

    // Parse numeric fields
    if (['quantity', 'unit_price', 'total'].includes(field)) {
      const numValue = parseFloat(editValue)
      parsedValue = isNaN(numValue) ? null : numValue
    }

    // Update the field directly on the line item
    const updates: Partial<LineItem> = {
      [field as keyof LineItem]: parsedValue
    }

    onLineItemUpdate(rowId, updates)
    setEditingCell(null)
    setEditValue('')
  }

  const handleCancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }


  const renderEditableCell = (
    item: LineItem,
    field: string,
    value: any,
    type: 'text' | 'number' = 'text'
  ) => {
    const isEditing = editingCell?.rowId === item.id && editingCell?.field === field

    if (isEditing) {
      return (
        <div className="flex items-center space-x-2">
          <input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyPress}
            className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <button
            onClick={handleSaveEdit}
            className="p-1 text-green-600 hover:text-green-700"
            title="Save"
          >
            <CheckIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleCancelEdit}
            className="p-1 text-red-600 hover:text-red-700"
            title="Cancel"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )
    }

    const displayValue = type === 'number' && typeof value === 'number' 
      ? formatCurrency(value)
      : value?.toString() || '-'

    return (
      <div 
        className="group cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-2 -my-1"
        onClick={() => handleStartEdit(item.id, field, value)}
      >
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-sm",
            (!value && value !== 0) && "text-gray-400 italic"
          )}>
            {displayValue}
          </span>
          <PencilIcon className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    )
  }

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => {
      const total = item.total || (item.quantity && item.unit_price ? item.quantity * item.unit_price : 0)
      return sum + (total || 0)
    }, 0)
  }

  if (lineItems.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No line items found in the document.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                UOM
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {lineItems.map((item, index) => (
              <tr key={item.id} className={cn(
                "hover:bg-gray-50 transition-colors",
                index % 2 === 0 ? "bg-white" : "bg-gray-25"
              )}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {renderEditableCell(item, 'item_number', item.item_number || item.part_number)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                  {renderEditableCell(item, 'description', item.description)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {renderEditableCell(item, 'quantity', item.quantity, 'number')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {renderEditableCell(item, 'unit_price', item.unit_price, 'number')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {renderEditableCell(item, 'total', item.total, 'number')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {renderEditableCell(item, 'uom', item.uom)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {lineItems.length} line item{lineItems.length !== 1 ? 's' : ''}
          </div>
          <div className="text-lg font-semibold text-gray-900">
            Total: {formatCurrency(calculateTotal())}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 px-6 py-3 border-t border-blue-100">
        <p className="text-xs text-blue-700">
          Click any cell to edit • Press Enter to save • Press Escape to cancel
        </p>
      </div>
    </div>
  )
}